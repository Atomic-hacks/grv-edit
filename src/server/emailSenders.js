// Email sending policy — the one place that decides who an email is *from*.
//
// 1. Every email GRV sends, customer-facing or brand-facing, is sent FROM a
//    GRV address below, through GRV's own Resend account. Provider
//    credentials (RESEND_API_KEY) and sender addresses live only in env vars.
// 2. Brands never supply a sender. Brand configuration (Brand.contactEmail)
//    only ever decides who *receives* brand-specific operational notices —
//    see notifyBrandsForOrder in orderEmails.js. A brand can't make GRV send
//    as them (Resend would reject an unverified domain anyway), and nothing
//    about the provider is reachable from brand settings.
// 3. Replies to customer and brand emails route to one support inbox
//    (REPLY_TO_SUPPORT), whatever address the email went out from.
//
//   Purpose                                         From            Reply-To
//   Account verification codes                      FROM_NOREPLY    —
//   Order / payment / shipping / delivery updates   FROM_INFO       support
//   Restock, sale, wishlist, cart reminders         FROM_INFO       —
//   Marketing campaigns                             FROM_INFO       —
//   Support replies, refund & complaint updates     FROM_SUPPORT    (itself)
//   Brand order notices (to the brand's inbox)      FROM_INFO       support
//   Internal new-order alert (to ADMIN_ALERT_EMAIL) FROM_INFO       —
//
// Password reset emails are sent by Supabase Auth, not this app — their
// sender is configured in the Supabase dashboard (Auth → SMTP settings).
//
// Each From falls back to RESEND_FROM_EMAIL, then to a sensible address at
// grvhq.com. Resend verifies at the domain level, so any @grvhq.com address
// sends once the domain is verified.
const fallback = process.env.RESEND_FROM_EMAIL;

export const FROM_INFO =
  process.env.RESEND_FROM_INFO || fallback || "GRV <info@grvhq.com>";

export const FROM_NOREPLY =
  process.env.RESEND_FROM_NOREPLY || fallback || "GRV <noreply@grvhq.com>";

export const FROM_SUPPORT =
  process.env.RESEND_FROM_SUPPORT || fallback || "GRV <support@grvhq.com>";

// Must be a mailbox that actually receives mail — being able to send from
// grvhq.com doesn't mean anything at grvhq.com receives replies.
export const REPLY_TO_SUPPORT =
  process.env.SUPPORT_INBOX_EMAIL || "support@grvhq.com";
