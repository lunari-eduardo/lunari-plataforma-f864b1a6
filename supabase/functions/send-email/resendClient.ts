import { FROM_EMAIL, RESEND_API_URL, isValidEmail } from './helpers.ts';

export async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  options: { replyTo?: string | null; fromName?: string | null; attachments?: any[] } = {}
) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY_MISSING');
  }

  const cleanFromName = options.fromName ? options.fromName.replace(/[<>"\r\n]/g, '').trim() : '';
  const fromAddress = cleanFromName ? `${cleanFromName} <contato@mail.lunarihub.com>` : FROM_EMAIL;

  const payload: Record<string, unknown> = { from: fromAddress, to: [to], subject, html };
  if (isValidEmail(options.replyTo)) payload.reply_to = options.replyTo.trim();
  if (options.attachments) payload.attachments = options.attachments;

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`RESEND_SEND_FAILED:${response.status}:${JSON.stringify(data)}`);
  }
  return data?.id ? String(data.id) : null;
}
