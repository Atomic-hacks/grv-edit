// Shared HTML wrapper for every transactional email the app sends (via
// sendEmail.js / Resend). Keeping one wrapper means the brand only needs to
// be updated in one place — this is also the file to restyle when adopting
// a new design direction, since it drives verification, order, and
// reminder emails alike.
const BRAND_NAME = "GRVHQ";
const ACCENT = "#ff5a00";
const INK = "#101010";
const MUTED = "#66645f";
const BORDER = "#dfddd7";
const PAPER = "#ffffff";
const CANVAS = "#f2f0eb";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const siteUrl = () =>
  (process.env.APP_URL || "http://localhost:5176").replace(/\/+$/, "");
const emailAssetUrl = (value) => {
  if (!value) return "";
  try {
    const url = new URL(String(value), `${siteUrl()}/`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};
const logoUrl = () =>
  emailAssetUrl(process.env.EMAIL_LOGO_URL || "/img/logoblack.png");

// button/link CTA used across templates
const ctaButton = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;"><tr><td bgcolor="${INK}" style="border-radius:2px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(label)}</a></td></tr></table>`;

const emailImage = ({ src, alt = "", href, width = "100%" } = {}) => {
  const safeSrc = emailAssetUrl(src);
  if (!safeSrc) return "";
  const image = `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(alt)}" width="560" style="display:block;width:${escapeHtml(width)};max-width:100%;height:auto;border:0;" />`;
  return href
    ? `<a href="${escapeHtml(href)}" style="display:block;text-decoration:none;">${image}</a>`
    : image;
};

// Wraps arbitrary inner HTML in the shared header/footer chrome.
// `preheader` is invisible inline preview text some email clients show
// next to the subject line.
const renderEmail = ({ preheader = "", bodyHtml }) => `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <style>
      @media only screen and (max-width:620px) {
        .email-shell { padding: 20px 10px !important; }
        .email-content { padding: 32px 22px !important; }
        .email-header { padding: 26px 22px !important; }
        .email-footer { padding: 24px 22px 30px !important; }
        .email-product-cell { display:block !important; width:100% !important; padding-right:0 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${CANVAS};">
    <span style="display:none;font-size:1px;color:${CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};">
      <tr>
        <td class="email-shell" align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${PAPER};border:1px solid ${BORDER};">
            <tr>
              <td style="padding:10px 24px;background:${INK};font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:10px;letter-spacing:0.16em;text-align:center;text-transform:uppercase;">
                Curated fashion &middot; Lagos, Nigeria
              </td>
            </tr>
            <tr>
              <td class="email-header" align="center" style="padding:32px 40px 26px;border-bottom:1px solid ${BORDER};">
                <a href="${escapeHtml(siteUrl())}" style="display:inline-block;text-decoration:none;"><img src="${escapeHtml(logoUrl())}" alt="${BRAND_NAME}" width="154" style="display:block;width:154px;max-width:100%;height:auto;border:0;" /></a>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:42px 40px 46px;font-family:Arial,Helvetica,sans-serif;color:${INK};font-size:15px;line-height:1.65;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:28px 40px 34px;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;text-align:center;">
                <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">
                  <a href="${escapeHtml(siteUrl())}/shop" style="color:${INK};text-decoration:none;">Shop</a>
                  <span style="padding:0 10px;color:${BORDER};">/</span>
                  <a href="${escapeHtml(siteUrl())}/account" style="color:${INK};text-decoration:none;">Account</a>
                  <span style="padding:0 10px;color:${BORDER};">/</span>
                  <a href="${escapeHtml(siteUrl())}/contact" style="color:${INK};text-decoration:none;">Contact</a>
                </p>
                <p style="margin:0 0 5px;font-size:12px;color:${MUTED};">${BRAND_NAME} &middot; <a href="${escapeHtml(siteUrl())}" style="color:${MUTED};text-decoration:none;">${escapeHtml(siteUrl().replace(/^https?:\/\//, ""))}</a></p>
                <p style="margin:0;font-size:11px;color:${MUTED};">Need help? <a href="mailto:support@grvhq.com" style="color:${MUTED};">support@grvhq.com</a></p>
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
    preheader: `Your GRVHQ verification code is ${code}`,
    bodyHtml: `
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${ACCENT};">Account security</p>
      <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:600;">Confirm your email</h1>
      <p style="margin:0 0 24px;color:${MUTED};">Enter this code to verify your ${BRAND_NAME} account:</p>
      <div style="margin:0 0 24px;padding:20px 24px;background:${CANVAS};border-left:3px solid ${ACCENT};">
        <p style="margin:0;font-size:34px;line-height:1;font-weight:700;letter-spacing:0.22em;color:${INK};">${escapeHtml(code)}</p>
      </div>
      <p style="margin:0;font-size:13px;color:${MUTED};">This code expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
    `,
  });

export const notificationEmail = ({ message, productUrl, productName, imageUrl }) =>
  renderEmail({
    preheader: message,
    bodyHtml: `
      ${emailImage({ src: imageUrl, alt: productName || "Product", href: productUrl })}
      <p style="margin:${imageUrl ? "24px" : "0"} 0 10px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${ACCENT};">From your GRVHQ list</p>
      ${productName ? `<h1 style="margin:0 0 12px;font-size:25px;line-height:1.25;font-weight:600;">${escapeHtml(productName)}</h1>` : ""}
      <p style="margin:0 0 22px;color:${MUTED};">${escapeHtml(message)}</p>
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
      ${ctaButton(`${siteUrl()}/shop`, "Return to GRVHQ")}
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
  CANVAS,
  BRAND_NAME,
  emailImage,
  emailAssetUrl,
  logoUrl,
};
