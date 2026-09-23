// Shared HTML wrapper for every transactional email the app sends (via
// sendEmail.js / Resend). Keeping one wrapper means the brand only needs to
// be updated in one place — this is also the file to restyle when adopting
// a new design direction, since it drives verification, order, and
// reminder emails alike.
const BRAND_NAME = "GRV";
const ACCENT = "#c45a18";
const INK = "#111111";
const MUTED = "#6b6b6b";
const BORDER = "#ececec";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const siteUrl = () => process.env.APP_URL || "http://localhost:5176";

// button/link CTA used across templates
const ctaButton = (href, label) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:8px;padding:12px 28px;background:${INK};color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;border-radius:2px;">${escapeHtml(label)}</a>`;

// Wraps arbitrary inner HTML in the shared header/footer chrome.
// `preheader` is invisible inline preview text some email clients show
// next to the subject line.
const renderEmail = ({ preheader = "", bodyHtml }) => `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f3;">
    <span style="display:none;font-size:1px;color:#f5f5f3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f3;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${BORDER};">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid ${BORDER};">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">${BRAND_NAME}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:${INK};font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid ${BORDER};">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};">${BRAND_NAME} &middot; <a href="${escapeHtml(siteUrl())}" style="color:${MUTED};">${escapeHtml(siteUrl().replace(/^https?:\/\//, ""))}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const verificationCodeEmail = (code) =>
  renderEmail({
    preheader: `Your GRV verification code is ${code}`,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;">Confirm your email</h1>
      <p style="margin:0 0 24px;color:${MUTED};">Enter this code to verify your ${BRAND_NAME} account:</p>
      <p style="margin:0 0 24px;font-size:34px;font-weight:700;letter-spacing:0.24em;color:${INK};">${escapeHtml(code)}</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">This code expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
    `,
  });

export const notificationEmail = ({ message, productUrl }) =>
  renderEmail({
    preheader: message,
    bodyHtml: `
      <p style="margin:0 0 20px;">${escapeHtml(message)}</p>
      ${ctaButton(productUrl, "View product")}
    `,
  });

export const abandonedCartEmail = (itemsHtml) =>
  renderEmail({
    preheader: "You left something in your Goody Bag.",
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">You left something behind</h1>
      <p style="margin:0 0 20px;color:${MUTED};">Your Goody Bag is still waiting for you.</p>
      <ul style="margin:0 0 24px;padding:0;list-style:none;">${itemsHtml}</ul>
      ${ctaButton(`${siteUrl()}/shop`, "Return to GRV")}
    `,
  });

export const wishlistReminderEmail = ({ imageHtml, productName, productUrl }) =>
  renderEmail({
    preheader: `Still thinking about ${productName}?`,
    bodyHtml: `
      ${imageHtml}
      <p style="margin:16px 0 20px;">Still thinking about <strong>${escapeHtml(productName)}</strong>?</p>
      ${ctaButton(productUrl, "Take another look")}
    `,
  });

export const adminOrderAlertEmail = ({ orderId, fullName, email, total, itemCount }) =>
  renderEmail({
    preheader: `New order #${orderId}`,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">New order #${escapeHtml(orderId)}</h1>
      <p style="margin:0 0 6px;">Customer: <strong>${escapeHtml(fullName)}</strong> (${escapeHtml(email)})</p>
      <p style="margin:0 0 6px;">Total: <strong>${escapeHtml(total)}</strong></p>
      <p style="margin:0;">Item count: ${escapeHtml(String(itemCount))}</p>
    `,
  });

export {
  escapeHtml,
  siteUrl,
  renderEmail,
  ctaButton,
  ACCENT,
  INK,
  MUTED,
  BORDER,
  BRAND_NAME,
};
