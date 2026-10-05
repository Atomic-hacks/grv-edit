// Admin → customer email: compose from info@ or support@ and send to one
// customer, a typed address, or a group. See server/directEmail.js for the
// consent rules.
import { randomUUID } from "node:crypto";
import { requireRole } from "../../server/requireRole.js";
import { recordAdminAction } from "../../server/auditLog.js";
import { runInBackground } from "../../server/background.js";
import { checkRateLimit } from "../../server/rateLimit.js";
import {
  AUDIENCES, BULK_AUDIENCES, MAX_RECIPIENTS, SENDERS,
  resolveDirectAudience, sendDirectEmails,
} from "../../server/directEmail.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Above this many recipients the send continues after the response, so the
// admin isn't left waiting on a spinner while dozens of emails go out.
const SYNC_LIMIT = 20;

const guardFor = (request) => requireRole(request, ["ADMIN", "SUPPORT"]);

const parse = async (request) => {
  const body = await request.json().catch(() => ({}));
  return {
    audience: body.audience,
    userId: body.userId,
    email: body.email,
    serviceNotice: Boolean(body.serviceNotice),
    sender: body.sender,
    subject: typeof body.subject === "string" ? body.subject.trim() : "",
    body: typeof body.body === "string" ? body.body.trim() : "",
    expectedCount: Number(body.expectedCount),
  };
};

// Support staff can write to a person; mailing a whole group is an admin call.
const canTarget = (user, audience) => !BULK_AUDIENCES.includes(audience) || user.role !== "SUPPORT";

export const getMessagingOptions = async (request) => {
  const guard = await guardFor(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  return jsonResponse({
    senders: Object.entries(SENDERS).map(([value, sender]) => ({
      value,
      label: sender.label,
      address: (sender.from.match(/<([^>]+)>/)?.[1] || sender.from).trim(),
    })),
    maxRecipients: MAX_RECIPIENTS,
    canMailGroups: guard.user.role !== "SUPPORT",
  });
};

export const previewMessageAudience = async (request) => {
  const guard = await guardFor(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const input = await parse(request);
  if (!AUDIENCES.includes(input.audience)) return jsonResponse({ error: "Choose who to email." }, 400);
  if (!canTarget(guard.user, input.audience)) return jsonResponse({ error: "Only admins can email groups." }, 403);

  const result = await resolveDirectAudience(input);
  if (result.error) return jsonResponse({ count: 0, skipped: 0, error: result.error });
  return jsonResponse({
    count: result.recipients.length,
    skipped: result.skipped,
    tooMany: result.recipients.length > MAX_RECIPIENTS,
    sample: result.recipients.slice(0, 3).map((recipient) => recipient.email),
  });
};

export const sendAdminMessage = async (request) => {
  const guard = await guardFor(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const input = await parse(request);

  if (!SENDERS[input.sender]) return jsonResponse({ error: "Choose a sender address." }, 400);
  if (!AUDIENCES.includes(input.audience)) return jsonResponse({ error: "Choose who to email." }, 400);
  if (!canTarget(guard.user, input.audience)) return jsonResponse({ error: "Only admins can email groups." }, 403);
  if (!input.subject || input.subject.length > 200) return jsonResponse({ error: "Add a subject (200 characters at most)." }, 400);
  if (!input.body || input.body.length > 10_000) return jsonResponse({ error: "Write a message (10,000 characters at most)." }, 400);

  const limit = await checkRateLimit(`admin-mail:${guard.user.id}`, { max: 20, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return jsonResponse({ error: "Too many emails sent this hour. Try again later." }, 429);

  const resolved = await resolveDirectAudience(input);
  if (resolved.error) return jsonResponse({ error: resolved.error }, 400);
  const { recipients } = resolved;
  if (recipients.length === 0) return jsonResponse({ error: "Nobody in that group can be emailed." }, 400);
  if (recipients.length > MAX_RECIPIENTS) {
    return jsonResponse({ error: `That group is over ${MAX_RECIPIENTS} people. Use a Campaign for a list that large.` }, 400);
  }
  // The admin confirmed a number on screen; if the group changed since,
  // make them look again rather than mailing a different group.
  if (input.expectedCount !== recipients.length) {
    return jsonResponse({ error: `The group changed: it now has ${recipients.length} people. Review and send again.` }, 409);
  }

  const isGroup = BULK_AUDIENCES.includes(input.audience);
  const job = async () => {
    const result = await sendDirectEmails({
      recipients, sender: input.sender, subject: input.subject, body: input.body,
      withUnsubscribe: isGroup && !input.serviceNotice,
    });
    await recordAdminAction({
      actorId: guard.user.id,
      action: "message.send",
      entityType: "Message",
      entityId: randomUUID(),
      newState: {
        sender: input.sender, audience: input.audience, serviceNotice: input.serviceNotice,
        subject: input.subject, recipients: recipients.length, sent: result.sent, failed: result.failed,
        ...(isGroup ? {} : { to: recipients[0].email }),
      },
    });
    return result;
  };

  if (recipients.length > SYNC_LIMIT) {
    runInBackground(job(), "Admin message send");
    return jsonResponse({ queued: true, total: recipients.length });
  }
  const result = await job();
  if (result.sent === 0) {
    return jsonResponse({ error: result.firstError || "The email could not be sent. Nothing was delivered." }, 502);
  }
  return jsonResponse({ queued: false, total: recipients.length, sent: result.sent, failed: result.failed });
};
