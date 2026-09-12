import { Resend } from "resend";

export const sendEmail = async ({ to, subject, html } = {}) => {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !to || !subject || !html) return false;

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "GRV <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    return !error;
  } catch (error) {
    console.error("Email send failed", error);
    return false;
  }
};
