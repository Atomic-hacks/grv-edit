import {
  escapeHtml,
  siteUrl,
  renderEmail,
  ctaButton,
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
    You're receiving this because you opted into GRV updates.
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.
  </p>`;

const productCard = (product) => {
  const image = product.imageUrl
    ? `<img src="${escapeHtml(product.imageUrl)}" width="150" alt="" style="display:block;width:100%;max-width:150px;height:auto;border:1px solid ${BORDER};" />`
    : "";
  const url = `${siteUrl()}/product/${encodeURIComponent(product.id)}`;
  return `
    <td style="padding:0 8px 16px 0;vertical-align:top;width:150px;">
      <a href="${escapeHtml(url)}" style="text-decoration:none;color:${INK};">
        ${image}
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
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" style="display:block;width:100%;height:auto;margin:0 0 24px;" />` : ""}
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;">${escapeHtml(subject)}</h1>
      <div style="margin:0 0 20px;font-size:15px;line-height:1.7;color:${INK};white-space:pre-wrap;">${escapeHtml(body)}</div>
      ${featuredProducts(products)}
      ${ctaUrl && ctaLabel ? ctaButton(ctaUrl, ctaLabel) : ctaButton(`${siteUrl()}/shop`, "Shop GRV")}
      ${unsubscribeUrl ? unsubscribeFooter(unsubscribeUrl) : ""}
    `,
  });
