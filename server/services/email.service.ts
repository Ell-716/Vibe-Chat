import { logger } from "../lib/logger";
import { env } from "../config/env";

const EMAILJS_API_URL = "https://api.emailjs.com/api/v1.0/email/send";

interface EmailJSParams {
  to_email: string;
  to_name: string;
  subject: string;
  message: string;
}

/**
 * Sends an email via the EmailJS REST API.
 * Returns false (without throwing) when EmailJS credentials are not configured,
 * preserving graceful degradation for local/dev environments.
 * @param params - Recipient and content fields for the EmailJS template.
 * @returns True if the email was sent successfully, false otherwise.
 */
async function sendEmailJS(params: EmailJSParams): Promise<boolean> {
  const { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY } = env;

  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    logger.info("EmailJS not configured - skipping email notification");
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(EMAILJS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://replit.com",
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: params,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (response.ok) {
      logger.info(`Email sent successfully via EmailJS to ${params.to_email}`);
      return true;
    }

    const errorText = await response.text();
    logger.error({ err: errorText }, "EmailJS error");
    return false;
  } catch (error) {
    logger.error({ err: error }, "Failed to send email via EmailJS");
    return false;
  }
}

/**
 * Notifies a customer that their support ticket has been created.
 * @param customerEmail - Recipient email address.
 * @param customerName - Recipient display name.
 * @param ticketId - Unique ticket identifier.
 * @param subject - Ticket subject line.
 * @param description - Original ticket description.
 * @returns True if the email was sent successfully, false otherwise.
 */
export async function sendTicketCreatedEmail(
  customerEmail: string,
  customerName: string,
  ticketId: string,
  subject: string,
  description: string
): Promise<boolean> {
  return sendEmailJS({
    to_email: customerEmail,
    to_name: customerName,
    subject: `Support Ticket Created: ${subject}`,
    message: `Hello ${customerName},\n\nThank you for contacting support. We have received your request.\n\nTicket ID: ${ticketId}\nSubject: ${subject}\n\nYour message:\n${description}\n\nOur team will respond shortly.\n\n- Vibe Chat Support`,
  });
}

/**
 * Notifies a customer that a support agent has replied to their ticket.
 * @param customerEmail - Recipient email address.
 * @param customerName - Recipient display name.
 * @param ticketId - Unique ticket identifier.
 * @param subject - Original ticket subject line.
 * @param agentName - Name of the agent who responded.
 * @param responseContent - The agent's response message body.
 * @returns True if the email was sent successfully, false otherwise.
 */
export async function sendAgentResponseEmail(
  customerEmail: string,
  customerName: string,
  ticketId: string,
  subject: string,
  agentName: string,
  responseContent: string
): Promise<boolean> {
  const htmlMessage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Support Update</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding:24px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#050A14;padding:24px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Vibe Chat Support</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">Hello ${customerName},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#444444;">Our support team has responded to your ticket.</p>

              <!-- Ticket ID box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color:#f0f0f0;border-radius:4px;padding:10px 16px;">
                    <span style="font-size:13px;color:#666666;">Ticket ID:&nbsp;</span>
                    <span style="font-size:13px;color:#333333;font-weight:600;">${ticketId}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:14px;color:#666666;">Response from: <strong style="color:#333333;">${agentName}</strong></p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;" />

              <!-- Response content -->
              <p style="margin:0;font-size:15px;color:#222222;line-height:1.6;white-space:pre-wrap;">${responseContent}</p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0 20px;" />

              <p style="margin:0 0 8px;font-size:14px;color:#555555;">If you need further assistance, please reply through our support portal.</p>
              <p style="margin:0;font-size:14px;color:#888888;">— Vibe Chat Support</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmailJS({
    to_email: customerEmail,
    to_name: customerName,
    subject: `Re: ${subject} - Support Update`,
    message: htmlMessage,
  });
}
