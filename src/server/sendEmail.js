import { Resend } from "resend";
import { htmlToText } from "./htmlToText.js";

export const sendEmail = async ({
  to,
  subject,
  html,
  from,
  replyTo,
  text,
  headers,
} = {}) => {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !to || !subject || !html) {
      return {
        sent: false,
        statusCode: 500,
        message: "Email configuration is incomplete",
      };
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: from || process.env.RESEND_FROM_EMAIL || "GRV <onboarding@resend.dev>",
      to,
      subject,
      html,
      // An HTML-only message with no text/plain alternative is a long-standing
      // spam signal. Derived from the HTML so there is only one template to
      // maintain, and overridable if a caller wants to write its own.
      text: text || htmlToText(html),
      ...(replyTo ? { replyTo } : {}),
      ...(headers ? { headers } : {}),
    });

    if (!error) return { sent: true };

    const statusCode = Number(error.statusCode) || 502;
    console.error("Resend email failed", {
      name: error.name,
      message: error.message,
      statusCode,
    });
    return { sent: false, statusCode, message: error.message };
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 502;
    console.error("Email send failed", {
      name: error?.name,
      message: error?.message,
      statusCode,
    });
    return {
      sent: false,
      statusCode,
      message: error?.message || "Email provider request failed",
    };
  }
};
