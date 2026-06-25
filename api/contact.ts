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

type ContactData = z.infer<typeof ContactSchema>;

function buildContactEmailHtml(data: ContactData): string {
  const { name, email, address, city, state, zip, phone, message } = data;
  const submittedAt = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e8ecf1;color:#64748b;font-size:13px;font-weight:600;width:120px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;">
        ${label}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e8ecf1;color:#1e293b;font-size:15px;line-height:1.5;vertical-align:top;font-family:Arial,Helvetica,sans-serif;">
        ${value}
      </td>
    </tr>`;

  const emailValue = `<a href="mailto:${escapeHtml(email)}" style="color:#2563eb;text-decoration:none;">${displayField(email)}</a>`;
  const phoneValue = phone?.trim()
    ? `<a href="tel:${escapeHtml(phone.trim())}" style="color:#2563eb;text-decoration:none;">${displayField(phone)}</a>`
    : displayField(phone);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Contact Form Submission</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af 0%,#2563eb 100%);padding:28px 32px;">
              <p style="margin:0 0 6px;color:rgba(255,255,255,0.85);font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:600;">
                EHC Help
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;">
                New Contact Submission
              </h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">
                ${escapeHtml(submittedAt)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 12px;color:#334155;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">
                Contact Details
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:8px;overflow:hidden;">
                ${row("Name", displayField(name))}
                ${row("Email", emailValue)}
                ${row("Phone", phoneValue)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <p style="margin:0 0 12px;color:#334155;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">
                Address
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:8px;overflow:hidden;">
                ${row("Street", displayField(address))}
                ${row("City", displayField(city))}
                ${row("State", displayField(state))}
                ${row("Zip", displayField(zip))}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;">
              <p style="margin:0 0 12px;color:#334155;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">
                Message
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:8px;padding:18px 20px;color:#1e293b;font-size:15px;line-height:1.7;">
                    ${escapeHtml(message).replace(/\n/g, "<br>")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:18px 32px;border-top:1px solid #e8ecf1;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">
                This email was sent from your website contact form.<br />
                Reply directly to this email to respond to <strong style="color:#64748b;">${displayField(name)}</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
      from: "onboarding@resend.dev",
      to: "davis1larry@gmail.com",
      subject: `New Contact Form: ${name}`,
      html: buildContactEmailHtml(parsed.data),
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
