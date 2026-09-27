// Which mailbox an email appears to come from, by purpose — not every
// message should look like it came from the same address. Each falls back
// to RESEND_FROM_EMAIL (the original single sender) if its own env var
// isn't set, so nothing breaks for a deploy that hasn't been given the new
// ones yet; and if even that's unset, it falls back to a sensible address
// at the same domain.
//
// No extra Resend setup is needed beyond what already exists — Resend
// verifies sending at the domain level (SPF/DKIM for grvhq.com), so any
// address at that domain works the moment the domain itself is verified.
const fallback = process.env.RESEND_FROM_EMAIL;

export const FROM_INFO =
  process.env.RESEND_FROM_INFO || fallback || "GRV <info@grvhq.com>";

export const FROM_NOREPLY =
  process.env.RESEND_FROM_NOREPLY || fallback || "GRV <noreply@grvhq.com>";

export const FROM_SUPPORT =
  process.env.RESEND_FROM_SUPPORT || fallback || "GRV <support@grvhq.com>";
