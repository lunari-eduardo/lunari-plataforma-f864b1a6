import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

export const FROM_EMAIL = 'Lunari <contato@mail.lunarihub.com>';
export const GALLERY_BASE_URL = 'https://app.lunarihub.com';
export const RESEND_API_URL = 'https://api.resend.com/emails';

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatCurrency(value: unknown): string {
  const numberValue = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue);
}

export function formatDate(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function formatDateOnly(value: unknown): string {
  if (!value) return 'Sem prazo definido';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(value)));
}

export function daysRemaining(value: unknown): string {
  if (!value) return '0';
  const today = new Date();
  const deadline = new Date(String(value));
  const diff = deadline.getTime() - today.getTime();
  return String(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
}

export function replaceTemplateVariables(template: string, variables: Record<string, string>) {
  return template.replace(/{(\w+)}/g, (match, key) => variables[key] ?? match);
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function getPhotographerReplyTo(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('profiles reply-to lookup error:', error.message);
    return null;
  }

  const email = typeof data?.email === 'string' ? data.email.trim() : '';
  return isValidEmail(email) ? email : null;
}

export function textToHtmlParagraphs(text: string) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#2D2A26;font-size:15px;line-height:1.7;">${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function paymentMethodLabel(payment: any): string {
  if (payment?.metodo_manual) return String(payment.metodo_manual);
  const provider = String(payment?.provedor || '').toLowerCase();
  const type = String(payment?.tipo_cobranca || '').toLowerCase();
  if (provider === 'infinitepay') return 'InfinitePay';
  if (provider === 'mercadopago') return 'Mercado Pago';
  if (provider === 'asaas') {
    if (type === 'pix') return 'PIX via Asaas';
    if (type === 'card') return 'Cartão via Asaas';
    return 'Asaas';
  }
  if (provider === 'manual') return 'Recebimento manual';
  return provider || 'Pagamento';
}

export async function upsertLog(supabase: any, log: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('email_delivery_logs')
    .upsert(log, { onConflict: 'idempotency_key' })
    .select('id')
    .single();

  if (error) console.error('email_delivery_logs upsert error:', error.message);
  return data?.id || null;
}

export async function getAuthenticatedUserId(req: Request, supabaseUrl: string, anonKey: string, serviceKey: string) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  if (token === serviceKey) return 'service-role';

  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function alreadySent(supabase: any, idempotencyKey: string) {
  const { data } = await supabase
    .from('email_delivery_logs')
    .select('id, status, friendly_message')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  return data?.status === 'enviado' ? data : null;
}
