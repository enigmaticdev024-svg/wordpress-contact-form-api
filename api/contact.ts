import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  message: z.string().trim().min(1),
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const parsed = ContactSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email, phone, subject, message } = parsed.data;
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: "noreply@ehchelp.com",
      to: "davis1larry@gmail.com",
      subject: subject || "New Contact Form Submission",
      html: `
        <h2>New Contact Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone ?? "N/A")}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject ?? "N/A")}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `,
      replyTo: email,
    });

    if (error) {
      console.error("Resend API error:", error);
      return res.status(502).json({
        success: false,
        message: "Failed to send email",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
      id: data?.id,
    });
  } catch (err) {
    console.error("Contact API error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
