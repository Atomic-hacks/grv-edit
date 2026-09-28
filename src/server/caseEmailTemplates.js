import { escapeHtml, renderEmail, INK, MUTED } from "./emailTemplates.js";

const ISSUE_TYPE_LABELS = {
  REFUND_REQUEST: "Refund request",
  WRONG_ITEM: "Wrong item received",
  MISSING_ITEM: "Missing item",
  DAMAGED_ITEM: "Damaged item",
  ITEM_NOT_AS_DESCRIBED: "Item not as described",
  PACKAGE_NOT_RECEIVED: "Package not received",
  DELIVERY_ISSUE: "Delivery issue",
  PAYMENT_ISSUE: "Payment issue",
  OTHER: "Other complaint",
};

export const issueTypeLabel = (type) => ISSUE_TYPE_LABELS[type] || type;

// Sent from FROM_SUPPORT (support@grvhq.com) the moment a case is created.
// Deliberately does not promise a specific resolution time — only a
// response window, which is realistic for a small team to actually meet.
export const caseAcknowledgementEmail = ({
  reference,
  orderId,
  issueType,
  submittedAt,
}) =>
  renderEmail({
    preheader: `We've received your request — reference ${reference}.`,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">We've received your request</h1>
      <p style="margin:0 0 20px;color:${MUTED};">Thanks for letting us know. Our support team will review this and follow up by email.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">Reference</td>
          <td style="padding:4px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${INK};">${escapeHtml(reference)}</td>
        </tr>
        ${
          orderId
            ? `<tr>
          <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">Order</td>
          <td style="padding:4px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${INK};">#${escapeHtml(orderId)}</td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">Issue type</td>
          <td style="padding:4px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${INK};">${escapeHtml(issueTypeLabel(issueType))}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">Submitted</td>
          <td style="padding:4px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${INK};">${escapeHtml(submittedAt)}</td>
        </tr>
      </table>
      <p style="margin:0 0 8px;">We aim to send a first response within <strong>1–2 business days</strong>.</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">We'll email you here with any updates — please keep an eye on your inbox (and spam folder). You can reply to this email if you need to add anything.</p>
    `,
  });

// Sent whenever an admin changes a case's status, so the customer never has
// to guess whether anything is happening.
export const caseStatusUpdateEmail = ({ reference, status, note }) =>
  renderEmail({
    preheader: `Update on your request ${reference}`,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">An update on your request</h1>
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">Reference ${escapeHtml(reference)}</p>
      <p style="margin:0 0 20px;font-size:15px;">Status: <strong>${escapeHtml(status)}</strong></p>
      ${note ? `<p style="margin:0 0 20px;color:${INK};white-space:pre-wrap;">${escapeHtml(note)}</p>` : ""}
      <p style="margin:0;font-size:13px;color:${MUTED};">Reply to this email if you have any questions.</p>
    `,
  });

export { ISSUE_TYPE_LABELS };
