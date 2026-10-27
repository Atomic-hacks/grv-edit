import { Resend } from "resend";
import { requireRole } from "../../server/requireRole.js";
import { SENDERS } from "../../server/directEmail.js";
import { FROM_NOREPLY } from "../../server/emailSenders.js";
import { htmlToText } from "../../server/htmlToText.js";
import { directEmailHtml } from "../../server/directEmail.js";
import { checkRateLimit } from "../../server/rateLimit.js";
import { recordAdminAction } from "../../server/auditLog.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const emailAddress = (value) => String(value || "").match(/<([^<>]+)>/)?.[1]?.trim().toLowerCase()
  || String(value || "").trim().toLowerCase();
const mailboxes = () => Object.entries({ ...SENDERS, NOREPLY: { label: "No reply", from: FROM_NOREPLY } })
  .map(([key, sender]) => ({ key, ...sender, address: emailAddress(sender.from) }));
export const addressedTo = (email, address) => [...(email.received_for || []), ...(email.to || []), ...(email.cc || []), ...(email.bcc || [])]
  .some((recipient) => emailAddress(recipient) === address);
const unwrap = (result) => {
  if (result.error) {
    const error = new Error(result.error.message || "Email provider request failed.");
    error.status = result.error.statusCode === 404 ? 404 : 502;
    throw error;
  }
  return result.data;
};

// Resend's list response can omit received_for on forwarded messages even
// though the detail response includes it. Cache only recipient metadata.
const forwardedRecipients = new Map();
const resolveRecipients = async (resend, email) => {
  if (email.received_for?.length || !(email.to || []).some((to) => emailAddress(to) === "dashboard@inbound.grvhq.com")) return email;
  const cached = forwardedRecipients.get(email.id);
  if (cached && cached.expires > Date.now()) return { ...email, received_for: cached.recipients };
  // Stay below Resend's default request rate while hydrating a bounded page.
  await new Promise((resolve) => setTimeout(resolve, 600));
  const detail = unwrap(await resend.emails.receiving.get(email.id));
  const recipients = detail.received_for || [];
  if (forwardedRecipients.size >= 500) forwardedRecipients.delete(forwardedRecipients.keys().next().value);
  forwardedRecipients.set(email.id, { recipients, expires: Date.now() + 10 * 60_000 });
  return { ...email, received_for: recipients };
};

// Read directly from Resend; incoming HTML is never executed in the admin browser.
export const handleInboxRequest = async (request, segments, url) => {
  const guard = await requireRole(request, ["ADMIN", "SUPPORT"]);
  if (!guard.ok) return json(guard.body, guard.status);
  const boxes = mailboxes();
  const enabled = process.env.INBOUND_EMAIL_ENABLED === "true";
  if (request.method === "GET" && segments[3] === "options") {
    return json({ enabled, mailboxes: boxes.map(({ key, label, address }) => ({ key, label, address })) });
  }
  if (!enabled || !process.env.RESEND_API_KEY) return json({ error: "Email receiving is not connected yet. Complete the Resend receiving setup." }, 503);
  const mailbox = boxes.find((box) => box.key === url.searchParams.get("mailbox"));
  if (!mailbox) return json({ error: "Choose an inbox." }, 400);
  const id = segments[3];
  if (id && !uuid.test(id)) return json({ error: "Invalid message ID." }, 400);
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    if (request.method === "GET" && !id) {
      const after = url.searchParams.get("after");
      if (after && !uuid.test(after)) return json({ error: "Invalid page cursor." }, 400);
      const page = unwrap(await resend.emails.receiving.list({ limit: 10, ...(after ? { after } : {}) }));
      const resolved = [];
      for (const email of page.data) resolved.push(await resolveRecipients(resend, email));
      const messages = resolved.filter((email) => addressedTo(email, mailbox.address))
        .map(({ id, from, to, subject, created_at }) => ({ id, from, to, subject, created_at }));
      return json({ messages, nextCursor: page.has_more ? page.data.at(-1)?.id : null });
    }
    if (!id) return json({ error: "Method not allowed." }, 405);
    const email = unwrap(await resend.emails.receiving.get(id));
    if (!addressedTo(email, mailbox.address)) return json({ error: "Message not found in this inbox." }, 404);
    if (request.method === "GET" && segments.length === 4) {
      return json({
        id: email.id, from: email.from, to: email.to, subject: email.subject,
        created_at: email.created_at, text: email.text || htmlToText(email.html),
        replyTo: emailAddress(email.reply_to?.[0] || email.from),
        attachments: (email.attachments || []).map(({ id, filename, size }) => ({ id, filename, size })),
      });
    }
    if (request.method === "GET" && segments[4] === "attachments" && uuid.test(segments[5] || "")) {
      const attachment = unwrap(await resend.emails.receiving.attachments.get({ emailId: id, id: segments[5] }));
      if (!attachment.download_url?.startsWith("https://")) return json({ error: "Attachment unavailable." }, 502);
      return json({ url: attachment.download_url });
    }
    if (request.method === "POST" && segments[4] === "reply" && segments.length === 5) {
      const input = await request.json().catch(() => ({}));
      const body = typeof input.body === "string" ? input.body.trim() : "";
      if (!body || body.length > 10_000) return json({ error: "Write a reply of up to 10,000 characters." }, 400);
      if (!uuid.test(input.requestId || "")) return json({ error: "A reply request ID is required." }, 400);
      const to = emailAddress(email.reply_to?.[0] || email.from);
      if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to)) return json({ error: "The sender has no valid reply address." }, 400);
      const limit = await checkRateLimit(`inbox-reply:${guard.user.id}`, { max: 30, windowMs: 60 * 60 * 1000 });
      if (!limit.allowed) return json({ error: "Too many replies this hour. Try again later." }, 429);
      const subject = /^re:/i.test(email.subject || "") ? email.subject : `Re: ${email.subject || "Your message"}`;
      const messageId = String(email.message_id || "").replace(/[\r\n]/g, "");
      const sent = unwrap(await resend.emails.send({
        from: mailbox.from, to, replyTo: mailbox.address, subject,
        text: body, html: directEmailHtml({ subject, body }),
        ...(messageId ? { headers: { "In-Reply-To": messageId, References: messageId } } : {}),
      }, { idempotencyKey: `inbox-reply/${guard.user.id}/${id}/${input.requestId}` }));
      await recordAdminAction({ actorId: guard.user.id, action: "inbox.reply", entityType: "Email", entityId: sent.id,
        newState: { sender: mailbox.address, to, subject, receivedEmailId: id } });
      return json({ sent: true, id: sent.id });
    }
    return json({ error: "Method not allowed." }, 405);
  } catch (error) {
    return json({ error: error.message || "Could not reach the email provider. Try again." }, error.status || 502);
  }
};
