import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendTicketCreatedEmail(
  customerEmail: string,
  customerName: string,
  ticketId: string,
  subject: string,
  description: string
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: `Support Ticket Created: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00c9a7;">Support Ticket Received</h2>
          <p>Hello ${customerName},</p>
          <p>Thank you for contacting our support team. We have received your request and will get back to you as soon as possible.</p>
          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Ticket ID:</strong> ${ticketId}</p>
            <p style="margin: 0 0 8px 0;"><strong>Subject:</strong> ${subject}</p>
            <p style="margin: 0;"><strong>Your message:</strong></p>
            <p style="margin: 8px 0 0 0; color: #666;">${description}</p>
          </div>
          <p>Our team is reviewing your request and will respond shortly.</p>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">This is an automated message from Vibe Chat Support.</p>
        </div>
      `,
    });
    
    console.log(`Ticket created email sent to ${customerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send ticket created email:', error);
    return false;
  }
}

export async function sendAgentResponseEmail(
  customerEmail: string,
  customerName: string,
  ticketId: string,
  subject: string,
  agentName: string,
  responseContent: string
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: `Re: ${subject} - Support Update`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00c9a7;">Support Team Response</h2>
          <p>Hello ${customerName},</p>
          <p>Our support team has responded to your ticket.</p>
          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Ticket ID:</strong> ${ticketId}</p>
            <p style="margin: 0 0 8px 0;"><strong>Subject:</strong> ${subject}</p>
            <p style="margin: 0 0 8px 0;"><strong>Response from:</strong> ${agentName}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 12px 0;" />
            <div style="white-space: pre-wrap;">${responseContent}</div>
          </div>
          <p>If you need further assistance, please reply to this ticket through our support portal.</p>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">This is an automated message from Vibe Chat Support.</p>
        </div>
      `,
    });
    
    console.log(`Agent response email sent to ${customerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send agent response email:', error);
    return false;
  }
}
