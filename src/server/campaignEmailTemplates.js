import {
  escapeHtml,
  siteUrl,
  renderEmail,
  ctaButton,
  emailAssetUrl,
  INK,
  MUTED,
  BORDER,
} from "./emailTemplates.js";
import { money } from "./orderEmailTemplates.js";

// A promotional email carries an unsubscribe link by law and by decency.
// The token is per-recipient, so the link identifies who to remove without
// asking them to log in first.
const unsubscribeFooter = (unsubscribeUrl) => `
  <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${BORDER};font-size:12px;line-height:1.6;color:${MUTED};">
    You're receiving this because you opted into GRVHQ updates.
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.
  </p>`;

const productCard = (product) => {
  const productImage = emailAssetUrl(product.imageUrl);
  const brandLogo = emailAssetUrl(product.brandLogo);
  const image = productImage
    ? `<img src="${escapeHtml(productImage)}" width="160" alt="${escapeHtml(product.name)}" style="display:block;width:100%;max-width:160px;height:auto;border:1px solid ${BORDER};" />`
    : "";
  const url = `${siteUrl()}/product/${encodeURIComponent(product.id)}`;
  return `
    <td class="email-product-cell" style="padding:0 12px 20px 0;vertical-align:top;width:33.33%;">
      <a href="${escapeHtml(url)}" style="text-decoration:none;color:${INK};">
        ${image}
        ${brandLogo ? `<img src="${escapeHtml(brandLogo)}" alt="${escapeHtml(product.brandName || "Brand")}" width="62" style="display:block;width:auto;max-width:62px;max-height:20px;margin:10px 0 4px;border:0;" />` : ""}
        ${product.brandName ? `<div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;">${escapeHtml(product.brandName)}</div>` : ""}
        <div style="margin-top:2px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};">${escapeHtml(product.name)}</div>
        <div style="margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;">${escapeHtml(money(product.basePrice))}</div>
      </a>
    </td>`;
};

// Featured products render as a simple row of up to three cards. Email
// clients handle a plain table row far more reliably than any grid.
const featuredProducts = (products) => {
  if (!products?.length) return "";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;width:100%;">
      <tr>${products.slice(0, 3).map(productCard).join("")}</tr>
    </table>`;
};

export const campaignEmail = ({
  subject,
  preheader,
  body,
  imageUrl,
  ctaLabel,
  ctaUrl,
  products = [],
  unsubscribeUrl,
}) =>
  renderEmail({
    preheader: preheader || subject,
    bodyHtml: `
      ${emailAssetUrl(imageUrl) ? `<img src="${escapeHtml(emailAssetUrl(imageUrl))}" alt="${escapeHtml(subject)}" style="display:block;width:100%;height:auto;margin:0 0 28px;" />` : ""}
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#ff5a00;">The GRVHQ edit</p>
      <h1 style="margin:0 0 16px;font-size:27px;line-height:1.25;font-weight:600;">${escapeHtml(subject)}</h1>
      <div style="margin:0 0 20px;font-size:15px;line-height:1.7;color:${INK};white-space:pre-wrap;">${escapeHtml(body)}</div>
      ${featuredProducts(products)}
      ${ctaUrl && ctaLabel ? ctaButton(ctaUrl, ctaLabel) : ctaButton(`${siteUrl()}/shop`, "Shop GRVHQ")}
      ${unsubscribeUrl ? unsubscribeFooter(unsubscribeUrl) : ""}
    `,
  });
