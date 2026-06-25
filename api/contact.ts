import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { z } from "zod";

// Matches WPForms form ID 315 payload from functions.php
const ContactSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip: z.string().trim().optional(),
  phone: z.string().trim().optional(),
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

function displayField(value: string | undefined): string {
  const trimmed = value?.trim();
  return escapeHtml(trimmed ? trimmed : "N/A");
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("[Contact API] Request received", {
    method: req.method,
    contentType: req.headers["content-type"],
    body: req.body,
  });

  if (req.method !== "POST") {
    console.warn("[Contact API] Rejected non-POST request", { method: req.method });
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    console.log("[Contact API] Validating form data", req.body);

    const parsed = ContactSchema.safeParse(req.body);

    if (!parsed.success) {
      console.warn("[Contact API] Validation failed", {
        body: req.body,
        errors: parsed.error.flatten().fieldErrors,
      });
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email, address, city, state, zip, phone, message } = parsed.data;
    console.log("[Contact API] Form data accepted", {
      name,
      email,
      address: address ?? null,
      city: city ?? null,
      state: state ?? null,
      zip: zip ?? null,
      phone: phone ?? null,
      messageLength: message.length,
    });

    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: "enigmaticdev024@gmail.com",
      to: "enigmaticdev024@gmail.com",
      subject: "New Contact Form Submission",
      html: `
        <h2>New Contact Submission</h2>
        <p><strong>Name:</strong> ${displayField(name)}</p>
        <p><strong>Email:</strong> ${displayField(email)}</p>
        <p><strong>Phone:</strong> ${displayField(phone)}</p>
        <p><strong>Address:</strong> ${displayField(address)}</p>
        <p><strong>City:</strong> ${displayField(city)}</p>
        <p><strong>State:</strong> ${displayField(state)}</p>
        <p><strong>Zip:</strong> ${displayField(zip)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `,
      replyTo: email,
    });

    if (error) {
      console.error("[Contact API] Resend API error:", error);
      return res.status(502).json({
        success: false,
        message: "Failed to send email",
      });
    }

    console.log("[Contact API] Email sent successfully", { emailId: data?.id });

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
      id: data?.id,
    });
  } catch (err) {
    console.error("[Contact API] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
