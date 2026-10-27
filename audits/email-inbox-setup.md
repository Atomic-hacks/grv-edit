# GRVHQ dashboard inbox setup

The Messages screen now has an **Email inbox** tab alongside the existing
**Contact form** tab. Inbox choices come from the configured Info, Support,
Fegorovie and No reply sender addresses. Admins, owners and support staff can
read received messages, download attachments and reply from the selected address.

## Current live configuration (checked 27 October 2026)

- Root-domain MX records still point to Cloudflare Email Routing. The catch-all
  remains disabled. Info, Support, Fegorovie and No reply each have an enabled
  rule invoking `grvhq-email-inbox`.
- `inbound.grvhq.com` is verified in Resend with receiving enabled and sending
  disabled (domain ID `6d1e9661-306c-4412-95f5-b0e203e4bd19`). Its receiving MX
  and DKIM TXT records are verified.
- Cloudflare destination `dashboard@inbound.grvhq.com` is verified (destination
  ID `410e44ce39004fcabf326785d5a1734e`). The Worker forwards to both this address
  and the existing Yahoo destination, preserving the original envelope recipient.
- The Cloudflare Global API Key connection works through Composio's authenticated
  proxy. The native zone-list tool incorrectly returns `Invalid access token`;
  this is a tool authentication issue, not evidence that the key is invalid.
- Vercel project `grv-edit` has `INBOUND_EMAIL_ENABLED=true` in Production and
  Preview. Local environment files remain unchanged. Deployment
  `grv-edit-kwd4wg4iu-atomics-projects-e609e4b0.vercel.app` has been promoted to
  production with the forwarded-recipient lookup fix.
- External Gmail tests reached Resend for all four mailboxes. Original addresses
  appear in the full message's `received_for` field, but can be absent from the
  list response; the server now resolves missing forwarded recipient metadata.
- Info's `inbox-test.txt` attachment downloaded successfully with the expected
  contents. Cloudflare's first external Support test has two successful delivery
  events with no errors; Yahoo's actual inbox has not been inspected.
- A combined Support + BCC No reply test was received only under Support in
  Resend. Individual No reply delivery and a separate BCC-only No reply test
  passed (received ID `38dbaba6-d3c0-4cd1-9e01-82623d7ac5e2`, with
  `noreply@grvhq.com` in `received_for`). Multiple GRVHQ recipients on the same
  message can still collapse into one inbox and need further investigation.

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
- Results use Resend cursor pagination with 10 messages per provider page. Each
  page is filtered by the selected address; a page may contain no matching
  messages while earlier pages exist. Missing forwarded recipient metadata is
  read from message details, paced at 600 ms between lookups, and cached for
  10 minutes (up to 500 entries) without caching message bodies.
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

The full suite passed all 178 tests across 37 files, including the 25 inbox,
direct-email and Worker tests and two new regressions for forwarded-recipient
lookup and provider lookup failure. Full ESLint, `git diff --check`, and
`npm run build` passed. The deployed unauthenticated
inbox endpoint rejects access. Live external receipt and attachment download were
verified as described above. The live production admin UI displays the received
Info test with its attachment
and no connection banner. A reply sent through the UI from `info@grvhq.com`
arrived in the external Gmail inbox in the original test thread.

References: [Resend receiving](https://resend.com/features/inbound),
[Cloudflare routing](https://developers.cloudflare.com/email-service/get-started/route-emails/),
[Cloudflare email Worker forwarding](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/).
