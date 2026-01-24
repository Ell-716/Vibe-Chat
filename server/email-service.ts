const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

interface EmailJSParams {
  to_email: string;
  to_name: string;
  ticket_id: string;
  subject: string;
  message: string;
  agent_name?: string;
}

async function sendEmailJS(templateId: string, params: EmailJSParams): Promise<boolean> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;

  if (!serviceId || !publicKey) {
    console.log('EmailJS not configured - skipping email notification');
    return false;
  }

  try {
    const response = await fetch(EMAILJS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
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
  const templateId = process.env.EMAILJS_TICKET_TEMPLATE_ID;
  
  if (!templateId) {
    console.log('EMAILJS_TICKET_TEMPLATE_ID not configured - skipping ticket created email');
    return false;
  }

  return sendEmailJS(templateId, {
    to_email: customerEmail,
    to_name: customerName,
    ticket_id: ticketId,
    subject: subject,
    message: description,
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
  const templateId = process.env.EMAILJS_RESPONSE_TEMPLATE_ID;
  
  if (!templateId) {
    console.log('EMAILJS_RESPONSE_TEMPLATE_ID not configured - skipping agent response email');
    return false;
  }

  return sendEmailJS(templateId, {
    to_email: customerEmail,
    to_name: customerName,
    ticket_id: ticketId,
    subject: subject,
    message: responseContent,
    agent_name: agentName,
  });
}
