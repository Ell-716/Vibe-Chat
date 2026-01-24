const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

interface EmailJSParams {
  to_email: string;
  to_name: string;
  subject: string;
  message: string;
}

async function sendEmailJS(params: EmailJSParams): Promise<boolean> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.log('EmailJS not configured - skipping email notification');
    return false;
  }

  try {
    console.log('Sending email with private key:', privateKey ? 'present' : 'missing');
    
    const response = await fetch(EMAILJS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'https://replit.com',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: params,
      }),
    });

    if (response.ok) {
      console.log(`Email sent successfully via EmailJS to ${params.to_email}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error('EmailJS error:', errorText);
      return false;
    }
  } catch (error) {
    console.error('Failed to send email via EmailJS:', error);
    return false;
  }
}

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
