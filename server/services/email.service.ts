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
    console.log("EmailJS not configured - skipping email notification");
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
      console.log(`Email sent successfully via EmailJS to ${params.to_email}`);
      return true;
    }

    const errorText = await response.text();
    console.error("EmailJS error:", errorText);
    return false;
  } catch (error) {
    console.error("Failed to send email via EmailJS:", error);
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
  return sendEmailJS({
    to_email: customerEmail,
    to_name: customerName,
    subject: `Re: ${subject} - Support Update`,
    message: `Hello ${customerName},\n\nOur support team has responded to your ticket.\n\nTicket ID: ${ticketId}\nResponse from: ${agentName}\n\n${responseContent}\n\nIf you need further assistance, please reply through our support portal.\n\n- Vibe Chat Support`,
  });
}
