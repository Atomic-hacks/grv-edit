# GRVHQ dashboard inbox setup

The Messages screen now has an **Email inbox** tab alongside the existing
**Contact form** tab. Inbox choices come from the configured Info, Support,
Fegorovie and No reply sender addresses. Admins, owners and support staff can
read received messages, download attachments and reply from the selected address.

## Current live configuration (checked 27 October 2026)

- `grvhq.com` is verified for sending in Resend; receiving is disabled.
- Root-domain MX records point to Cloudflare Email Routing.
- Cloudflare rules have been inspected: Info and Support have enabled forward
  rules, and the catch-all is disabled. No rule exists for Fegorovie or No reply.
  The connector redacts destination values; the owner identifies Yahoo as the
  destination to preserve.
- `inbound.grvhq.com` has been added to Resend with sending disabled and receiving
  enabled (domain ID `6d1e9661-306c-4412-95f5-b0e203e4bd19`). Its inbound MX and
  DKIM TXT records have been added to Cloudflare and resolve publicly. Resend
  verification is still pending.
- Cloudflare destination `dashboard@inbound.grvhq.com` has been added and is
  awaiting its verification email.
- Worker `grvhq-email-inbox` has been uploaded and deployed, but is not attached
  to any mail rules. Source is `scripts/grvhqEmailWorker.js`; it forwards to
  Yahoo and the dashboard destination, preserving the envelope recipient in an
  additional header. Both destinations must be verified before attaching rules.
- Root-domain MX and existing Info/Support rules remain unchanged.
- A preview deployment is ready at
  `https://grv-edit-7g7qyiv5w-atomics-projects-e609e4b0.vercel.app`.
  Receiving remains disabled in the application until delivery is verified.
- A direct internal test to the inbound address was accepted by its receiving
  mail server, but has not appeared in Resend's receiving API. Do not equate
  provider acceptance with a working dashboard inbox.

## Connect receiving while keeping Yahoo delivery

1. Inspect Cloudflare's existing routing rules, catch-all rule, verified
   destination addresses and any email Workers. Save the current settings.
2. Obtain the team's receiving address from Resend. For a dedicated receiving
   subdomain instead, configure and verify the receiving MX record supplied by
   Resend on that subdomain. Keep the root-domain Cloudflare MX records intact.
3. Add and verify the receiving address as a Cloudflare destination. Resend's
   dashboard receiving view can be used to read the verification email.
4. Cloudflare rules support one destination per pattern. To deliver to both
   Yahoo and Resend, use an email Worker that forwards to both verified
   destinations. Preserve existing Yahoo destinations and unrelated rules.
   Restrict changed rules to the addresses the dashboard should receive.
5. Confirm Resend retains the original GRVHQ recipients (`to`, `cc`, `bcc` or
   `received_for`) so messages appear under the correct mailbox, including BCC.
6. The server's `RESEND_API_KEY` needs read/full access. Once receiving works,
   set `INBOUND_EMAIL_ENABLED=true` in the intended deployment environment and
   deploy the code. This flag defaults to off; never expose the key to the client.
7. Send a test from an external account to each GRVHQ address. Verify both
   Yahoo delivery and dashboard receipt, attachment download, and a threaded
   reply from the matching address before considering setup complete.

## Implementation and limits

- The authenticated `/api/admin/inbox` endpoints read directly from Resend;
  no database migration or webhook is needed.
- Results use Resend cursor pagination. Each page is filtered by the selected
  address; a page may contain no matching messages while earlier pages exist.
- Mail refreshes every minute while its inbox is open; Refresh is also available.
- Incoming HTML is converted to plain text and displayed as escaped React text.
  Remote images and incoming scripts are not loaded. Attachments are downloaded
  through fresh provider URLs after checking the message belongs to the inbox.
- Replies use the incoming Reply-To (or From), matching GRVHQ sender, threading
  headers, a rate limit, an idempotency key and an admin audit record.
- Mail is stored by Resend, subject to its account retention policy. This is not
  a permanent archive or a migration of messages already forwarded to Yahoo.
- This version has no read/unread labels, deletion, sent folder or conversation
  history view. Existing contact-form read/replied tracking remains separate.

## Verification

`npm test -- src/api/__tests__/inbox.test.js src/server/__tests__/directEmail.test.js`
passed all 20 tests. Worker tests add 3 passing checks (23 total). Targeted ESLint, `git diff --check` and `npx vite build`
passed. The design detector reported no deterministic findings. A rendered UI
check and live send/receive verification remain pending; no browser was available
in this session.

References: [Resend receiving](https://resend.com/features/inbound),
[Cloudflare routing](https://developers.cloudflare.com/email-service/get-started/route-emails/),
[Cloudflare email Worker forwarding](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/).
