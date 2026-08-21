import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FROM_EMAIL = 'Lunari <contato@mail.lunarihub.com>';
const GALLERY_BASE_URL = 'https://app.lunarihub.com';
const RESEND_API_URL = 'https://api.resend.com/emails';

type EventType = 'gallery_sent' | 'payment_confirmed' | 'gallery_reactivated' | 'selection_confirmed' | 'selection_reminder';

interface RequestBody {
  eventType?: EventType;
  galleryId?: string;
  paymentId?: string;
  publicToken?: string;
  visitorId?: string;
  forceResend?: boolean;
  isDeliver?: boolean;
  customSubject?: string;
  customBody?: string;
  recipientEmail?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value: unknown): string {
  const numberValue = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue);
}

function formatDate(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatDateOnly(value: unknown): string {
  if (!value) return 'Sem prazo definido';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(value)));
}

function daysRemaining(value: unknown): string {
  if (!value) return '0';
  const today = new Date();
  const deadline = new Date(String(value));
  const diff = deadline.getTime() - today.getTime();
  return String(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
}

function replaceTemplateVariables(template: string, variables: Record<string, string>) {
  return template.replace(/{(\w+)}/g, (match, key) => variables[key] ?? match);
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function getPhotographerReplyTo(supabase: any, userId: string) {
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

function textToHtmlParagraphs(text: string) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#2D2A26;font-size:15px;line-height:1.7;">${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function paymentMethodLabel(payment: any): string {
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

interface DetailItem {
  label: string;
  value: string;
  isBold?: boolean;
}

interface BuildLayoutParams {
  preview: string;
  title: string;
  children: string;
  buttonUrl?: string;
  buttonText?: string;
  studioName: string;
  studioLogoUrl?: string | null;
  primaryColor?: string | null;
  badgeText?: string | null;
  details?: DetailItem[];
}

/**
 * Constrói o layout HTML do e-mail com design premium, alinhado à identidade visual
 * do fotógrafo (cores do tema, logo do estúdio e tipografia editorial).
 */
function buildLayout(params: BuildLayoutParams) {
  const primaryColor = params.primaryColor || '#A4553A';
  
  // Header: Logo do estúdio ou Nome Fantasia estilizado
  const headerContent = params.studioLogoUrl
    ? `<div style="text-align:center;margin-bottom:28px;">
        <img src="${escapeHtml(params.studioLogoUrl)}" alt="${escapeHtml(params.studioName)}" style="max-height:56px;max-width:240px;height:auto;width:auto;object-fit:contain;display:inline-block;" />
       </div>`
    : `<div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${escapeHtml(primaryColor)};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          ${escapeHtml(params.studioName)}
        </span>
       </div>`;

  // Badge opcional (ex: "Galeria de Entrega" ou "Seleção de Fotos")
  const badgeHtml = params.badgeText
    ? `<div style="text-align:center;margin-bottom:16px;">
        <span style="display:inline-block;background-color:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);color:#6B635B;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:20px;">
          ${escapeHtml(params.badgeText)}
        </span>
       </div>`
    : '';

  // Box de detalhes / informações da sessão
  let detailsHtml = '';
  if (params.details && params.details.length > 0) {
    const rows = params.details.map((d, index) => {
      const borderStyle = index > 0 ? 'border-top:1px solid #EBE5DF;' : '';
      return `<tr>
        <td style="padding:11px 16px;color:#78716C;font-size:13px;${borderStyle}">${escapeHtml(d.label)}</td>
        <td align="right" style="padding:11px 16px;color:#1C1917;font-size:13px;${d.isBold ? 'font-weight:700;' : 'font-weight:500;'}${borderStyle}">${escapeHtml(d.value)}</td>
      </tr>`;
    }).join('');

    detailsHtml = `
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#F9F8F6;border:1px solid #EAE5DF;border-radius:12px;margin:22px 0 10px;overflow:hidden;">
        ${rows}
      </table>
    `;
  }

  // Botão CTA estilizado com a cor da identidade do fotógrafo
  const button = params.buttonUrl ? `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 20px;width:100%;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(params.buttonUrl)}" style="display:inline-block;background-color:${escapeHtml(primaryColor)};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.04em;text-transform:uppercase;border-radius:10px;padding:16px 36px;box-shadow:0 4px 14px rgba(0,0,0,0.12);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            ${escapeHtml(params.buttonText || 'Acessar')}
          </a>
        </td>
      </tr>
    </table>` : '';

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;background-color:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2D2A26;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preview)}</div>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background-color:#F5F4F0;padding:40px 16px 48px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;background:#FFFFFF;border:1px solid #E8E3DC;border-radius:20px;box-shadow:0 8px 30px rgba(0,0,0,0.04);overflow:hidden;">
            <tr>
              <td style="padding:44px 36px 36px;">
                ${headerContent}
                ${badgeHtml}
                <h1 style="margin:0 0 22px;color:#1C1917;font-size:26px;line-height:1.25;font-weight:700;text-align:center;font-family:Georgia,'Times New Roman',serif;">
                  ${escapeHtml(params.title)}
                </h1>
                
                <div style="margin:0 0 8px;">
                  ${params.children}
                </div>

                ${detailsHtml}
                ${button}

                <div style="margin-top:32px;padding-top:20px;border-top:1px solid #F0ECE7;text-align:center;">
                  <p style="margin:0;color:#78716C;font-size:13px;line-height:1.6;">
                    Com carinho,<br>
                    <strong style="color:#1C1917;font-size:14px;">${escapeHtml(params.studioName)}</strong>
                  </p>
                </div>
              </td>
            </tr>
          </table>

          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;margin-top:20px;">
            <tr>
              <td align="center" style="color:#A8A29E;font-size:11px;line-height:1.5;">
                Enviado com carinho através de <a href="https://lunarihub.com" style="color:#A8A29E;text-decoration:underline;">Lunari</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendResendEmail(to: string, subject: string, html: string, options: { replyTo?: string | null } = {}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY_MISSING');
  }

  const payload: Record<string, unknown> = { from: FROM_EMAIL, to: [to], subject, html };
  if (isValidEmail(options.replyTo)) payload.reply_to = options.replyTo.trim();

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

async function upsertLog(supabase: any, log: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('email_delivery_logs')
    .upsert(log, { onConflict: 'idempotency_key' })
    .select('id')
    .single();

  if (error) console.error('email_delivery_logs upsert error:', error.message);
  return data?.id || null;
}

async function getAuthenticatedUserId(req: Request, supabaseUrl: string, anonKey: string, serviceKey: string) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  if (token === serviceKey) return 'service-role';

  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

async function alreadySent(supabase: any, idempotencyKey: string) {
  const { data } = await supabase
    .from('email_delivery_logs')
    .select('id, status, friendly_message')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  return data?.status === 'enviado' ? data : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return jsonResponse({ success: false, error: 'Método não permitido' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({})) as RequestBody;

    const validEvents: EventType[] = ['gallery_sent', 'payment_confirmed', 'gallery_reactivated', 'selection_confirmed', 'selection_reminder'];
    if (!body.eventType || !validEvents.includes(body.eventType)) {
      return jsonResponse({ success: false, status: 'erro', message: 'Evento de e-mail inválido' }, 400);
    }

    const callerUserId = await getAuthenticatedUserId(req, supabaseUrl, anonKey, serviceKey);
    if (!callerUserId) return jsonResponse({ success: false, status: 'erro', message: 'Autenticação obrigatória' }, 401);

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. EVENTO: GALLERY_SENT (Envio de galeria - Seleção ou Entrega)
    // ─────────────────────────────────────────────────────────────────────────────
    if (body.eventType === 'gallery_sent') {
      if (!body.galleryId) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não informada' }, 400);

      const { data: gallery, error: galleryError } = await supabase
        .from('galerias')
        .select('id, user_id, tipo, cliente_id, cliente_nome, cliente_email, nome_sessao, permissao, gallery_password, public_token, prazo_selecao, total_fotos, fotos_selecionadas, total_fotos_extras_vendidas, valor_extras, theme_id, use_custom_theme, theme_overrides')
        .eq('id', body.galleryId)
        .maybeSingle();

      if (galleryError || !gallery) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não encontrada' }, 404);
      if (callerUserId !== 'service-role' && callerUserId !== gallery.user_id) {
        return jsonResponse({ success: false, status: 'erro', message: 'Sem permissão para enviar e-mail desta galeria' }, 403);
      }

      const isDeliver = Boolean(body.isDeliver || gallery.tipo === 'entrega');
      const isForceResend = Boolean(body.forceResend || body.customSubject || body.customBody || body.recipientEmail);
      const idempotencyKey = isForceResend
        ? `gallery_sent:${gallery.id}:${Date.now()}`
        : `gallery_sent:${gallery.id}`;

      if (!isForceResend) {
        const sent = await alreadySent(supabase, idempotencyKey);
        if (sent) return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail já enviado anteriormente.', logId: sent.id });
      }

      const [{ data: settings }, { data: ownerProfile }] = await Promise.all([
        supabase
          .from('gallery_settings')
          .select('*')
          .eq('user_id', gallery.user_id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('nome, empresa, logo_url, email')
          .eq('user_id', gallery.user_id)
          .maybeSingle(),
      ]);

      const targetEmail = (body.recipientEmail || gallery.cliente_email || '').trim();

      const baseLog = {
        user_id: gallery.user_id,
        cliente_id: gallery.cliente_id || null,
        cliente_nome: gallery.cliente_nome || null,
        cliente_email: targetEmail || null,
        event_type: 'gallery_sent',
        gallery_id: gallery.id,
        payment_id: null,
        idempotency_key: idempotencyKey,
        metadata: { 
          source: 'gallery_sent', 
          isDeliver,
          publicTokenProvided: Boolean(body.publicToken), 
          isResend: isForceResend,
          customRecipient: Boolean(body.recipientEmail)
        },
        updated_at: new Date().toISOString(),
      };

      if (!isForceResend && settings?.email_sending_enabled === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio automático desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mails automáticos estão desativados.' });
      }
      if (!isForceResend && settings?.email_on_gallery_sent === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio de galeria desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Envio de e-mail de galeria está desativado.' });
      }
      if (!targetEmail || !isValidEmail(targetEmail)) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Cliente sem e-mail válido cadastrado' });
        return jsonResponse({ success: false, status: 'erro', message: 'Destinatário sem e-mail válido cadastrado.' }, 400);
      }

      const token = body.publicToken || gallery.public_token;
      if (!token || token.length < 8) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Link da galeria indisponível' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Link da galeria indisponível.' });
      }

      // 🎨 Resolução de Identidade Visual e Cores do Tema do Fotógrafo
      const studioCandidate = (settings?.studio_name || '').trim();
      const companyCandidate = (ownerProfile?.empresa || '').trim();
      const nameCandidate = (ownerProfile?.nome || '').trim();
      let studioName = 'Lunari';
      if (studioCandidate && studioCandidate !== 'Meu Estúdio') {
        studioName = studioCandidate;
      } else if (companyCandidate) {
        studioName = companyCandidate;
      } else if (nameCandidate) {
        studioName = nameCandidate;
      } else if (studioCandidate) {
        studioName = studioCandidate;
      }

      const studioLogoUrl =
        (settings?.studio_logo_url && String(settings.studio_logo_url).trim()) ||
        (ownerProfile?.logo_url && String(ownerProfile.logo_url).trim()) ||
        null;

      // Cor primária do tema ativo
      let primaryColor = '#A4553A';
      const themeId = gallery.use_custom_theme ? gallery.theme_id : (settings?.active_theme_id || settings?.default_theme_id);
      if (themeId && themeId !== 'lunari' && themeId !== 'system') {
        const { data: themeData } = await supabase
          .from('gallery_themes')
          .select('primary_color')
          .eq('id', themeId)
          .maybeSingle();
        if (themeData?.primary_color) {
          primaryColor = themeData.primary_color;
        }
      }
      if (gallery.theme_overrides?.primary_color) {
        primaryColor = gallery.theme_overrides.primary_color;
      } else if (settings?.theme_overrides?.primary_color) {
        primaryColor = settings.theme_overrides.primary_color;
      }

      const replyTo = await getPhotographerReplyTo(supabase, gallery.user_id);
      const galleryUrl = `${GALLERY_BASE_URL}/g/${encodeURIComponent(token)}`;

      const { data: template } = await supabase
        .from('gallery_email_templates')
        .select('subject, body')
        .eq('user_id', gallery.user_id)
        .eq('type', 'gallery_sent')
        .maybeSingle();

      const variables = {
        cliente: gallery.cliente_nome || 'Cliente',
        galeria: gallery.nome_sessao || 'Galeria',
        prazo: formatDateOnly(gallery.prazo_selecao),
        link: galleryUrl,
        estudio: studioName,
        dias_restantes: daysRemaining(gallery.prazo_selecao),
        total_fotos: String(gallery.total_fotos || gallery.fotos_selecionadas || 0),
        fotos_extras: String(gallery.total_fotos_extras_vendidas || 0),
        valor_extra: formatCurrency(gallery.valor_extras || 0),
      };

      let subject = '';
      let bodyText = '';

      if (body.customSubject && body.customSubject.trim()) {
        subject = body.customSubject.trim();
      } else if (isDeliver) {
        subject = `Suas fotos finais estão prontas para download ✨ - ${gallery.nome_sessao || 'Galeria'}`;
      } else {
        subject = replaceTemplateVariables(template?.subject || 'Suas fotos já estão prontas ✨', variables);
      }

      if (body.customBody && body.customBody.trim()) {
        bodyText = body.customBody.trim();
      } else if (isDeliver) {
        bodyText = `Olá, ${gallery.cliente_nome || 'Cliente'}!\n\nÉ com muita alegria que entregamos as fotos finais da sua sessão "${gallery.nome_sessao || 'Galeria'}"!\n\nSuas fotos já foram tratadas com todo o carinho e estão prontas para você visualizar, recordar e baixar em alta resolução.\n\nAproveite cada momento!`;
      } else {
        bodyText = replaceTemplateVariables(template?.body || 'Olá {cliente}!\n\nVocê já pode visualizar, escolher suas favoritas e garantir suas fotos.\n\nAcesse sua galeria pelo link abaixo.\n\nCom carinho,\n{estudio}', variables);
      }

      // Detalhes da sessão
      const detailsList: DetailItem[] = [
        { label: 'Sessão', value: gallery.nome_sessao || 'Sessão de Fotos', isBold: true },
      ];

      if (gallery.total_fotos || gallery.fotos_selecionadas) {
        detailsList.push({
          label: isDeliver ? 'Fotos entregues' : 'Total de fotos',
          value: `${gallery.total_fotos || gallery.fotos_selecionadas} fotos`,
        });
      }

      if (gallery.permissao === 'private' && gallery.gallery_password) {
        detailsList.push({
          label: 'Senha de acesso',
          value: gallery.gallery_password,
          isBold: true,
        });
      }

      if (gallery.prazo_selecao) {
        detailsList.push({
          label: isDeliver ? 'Disponível até' : 'Prazo de seleção',
          value: formatDateOnly(gallery.prazo_selecao),
        });
      }

      const html = buildLayout({
        studioName,
        studioLogoUrl,
        primaryColor,
        title: subject,
        badgeText: isDeliver ? 'Entrega de Fotos' : 'Seleção de Fotos',
        preview: isDeliver ? 'Suas fotos em alta resolução já estão disponíveis para download.' : 'Você já pode visualizar, escolher suas favoritas e garantir suas fotos.',
        buttonUrl: galleryUrl,
        buttonText: isDeliver ? 'Acessar e Baixar Fotos' : 'Acessar Minha Galeria',
        details: detailsList,
        children: textToHtmlParagraphs(bodyText),
      });

      try {
        const resendMessageId = await sendResendEmail(targetEmail, subject, html, { replyTo });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail de entrega enviado para o cliente', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: true, status: 'enviado', message: 'E-mail enviado com sucesso para o cliente.', logId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const friendly = errorMessage === 'RESEND_API_KEY_MISSING' ? 'Configuração do Resend ausente' : 'Falha ao enviar pelo provedor';
        await upsertLog(supabase, { ...baseLog, status: 'erro', subject, friendly_message: friendly, error_message: errorMessage, metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: false, status: 'erro', message: 'Não foi possível enviar o e-mail agora.', error: errorMessage }, 500);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. EVENTO: GALLERY_REACTIVATED (Reativação de galeria)
    // ─────────────────────────────────────────────────────────────────────────────
    if (body.eventType === 'gallery_reactivated') {
      if (!body.galleryId) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não informada' }, 400);

      const { data: gallery, error: galleryError } = await supabase
        .from('galerias')
        .select('id, user_id, cliente_id, cliente_nome, cliente_email, nome_sessao, permissao, gallery_password, public_token, prazo_selecao, total_fotos, fotos_selecionadas, total_fotos_extras_vendidas, valor_extras')
        .eq('id', body.galleryId)
        .maybeSingle();

      if (galleryError || !gallery) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não encontrada' }, 404);
      if (callerUserId !== 'service-role' && callerUserId !== gallery.user_id) {
        return jsonResponse({ success: false, status: 'erro', message: 'Sem permissão para enviar e-mail desta galeria' }, 403);
      }

      const isForceResend = Boolean(body.forceResend);
      const prazoKey = gallery.prazo_selecao ? new Date(String(gallery.prazo_selecao)).toISOString() : 'no_deadline';
      const idempotencyKey = isForceResend
        ? `gallery_reactivated:${gallery.id}:${prazoKey}:${Date.now()}`
        : `gallery_reactivated:${gallery.id}:${prazoKey}`;

      if (!isForceResend) {
        const sent = await alreadySent(supabase, idempotencyKey);
        if (sent) return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail já enviado para esta reativação.', logId: sent.id });
      }

      const [{ data: settings }, { data: ownerProfile }] = await Promise.all([
        supabase
          .from('gallery_settings')
          .select('*')
          .eq('user_id', gallery.user_id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('nome, empresa, logo_url, email')
          .eq('user_id', gallery.user_id)
          .maybeSingle(),
      ]);

      const baseLog = {
        user_id: gallery.user_id,
        cliente_id: gallery.cliente_id || null,
        cliente_nome: gallery.cliente_nome || null,
        cliente_email: gallery.cliente_email || null,
        event_type: 'gallery_reactivated',
        gallery_id: gallery.id,
        payment_id: null,
        idempotency_key: idempotencyKey,
        metadata: { source: 'gallery_reactivated', prazo_selecao: gallery.prazo_selecao, isResend: isForceResend },
        updated_at: new Date().toISOString(),
      };

      if (settings?.email_sending_enabled === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio automático desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mails automáticos estão desativados.' });
      }
      if (settings?.email_on_gallery_reactivated === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio de reativação desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail de reativação está desativado.' });
      }
      if (!gallery.cliente_email) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Cliente sem e-mail cadastrado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Cliente não possui e-mail cadastrado.' });
      }

      const token = body.publicToken || gallery.public_token;
      if (!token || token.length < 8) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Link da galeria indisponível' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Link da galeria indisponível.' });
      }

      const studioCandidate = (settings?.studio_name || '').trim();
      const companyCandidate = (ownerProfile?.empresa || '').trim();
      const nameCandidate = (ownerProfile?.nome || '').trim();
      const studioName = (studioCandidate && studioCandidate !== 'Meu Estúdio') ? studioCandidate : (companyCandidate || nameCandidate || 'Lunari');
      const studioLogoUrl = settings?.studio_logo_url || ownerProfile?.logo_url || null;

      const replyTo = await getPhotographerReplyTo(supabase, gallery.user_id);
      const galleryUrl = `${GALLERY_BASE_URL}/g/${encodeURIComponent(token)}`;
      const { data: template } = await supabase
        .from('gallery_email_templates')
        .select('subject, body')
        .eq('user_id', gallery.user_id)
        .eq('type', 'gallery_reactivated')
        .maybeSingle();

      const variables = {
        cliente: gallery.cliente_nome || 'Cliente',
        galeria: gallery.nome_sessao || 'Galeria',
        prazo: formatDateOnly(gallery.prazo_selecao),
        link: galleryUrl,
        estudio: studioName,
        dias_restantes: daysRemaining(gallery.prazo_selecao),
        total_fotos: String(gallery.total_fotos || gallery.fotos_selecionadas || 0),
        fotos_extras: String(gallery.total_fotos_extras_vendidas || 0),
        valor_extra: formatCurrency(gallery.valor_extras || 0),
      };
      const subject = replaceTemplateVariables(template?.subject || 'Sua galeria foi reaberta - {galeria}', variables);
      const bodyText = replaceTemplateVariables(template?.body || 'Olá {cliente}!\n\nBoas notícias: a galeria "{galeria}" foi reaberta para você concluir sua seleção de fotos.\n\nVocê tem até {prazo} para escolher suas favoritas.\n\nCom carinho,\n{estudio}', variables);
      
      const detailsList: DetailItem[] = [
        { label: 'Sessão', value: gallery.nome_sessao || 'Galeria', isBold: true },
        { label: 'Novo Prazo', value: formatDateOnly(gallery.prazo_selecao), isBold: true },
      ];
      if (gallery.permissao === 'private' && gallery.gallery_password) {
        detailsList.push({ label: 'Senha de acesso', value: gallery.gallery_password });
      }

      const html = buildLayout({
        studioName,
        studioLogoUrl,
        title: subject,
        preview: 'Sua galeria foi reaberta para você concluir a seleção.',
        buttonUrl: galleryUrl,
        buttonText: 'Acessar Minha Galeria',
        details: detailsList,
        children: textToHtmlParagraphs(bodyText),
      });

      try {
        const resendMessageId = await sendResendEmail(gallery.cliente_email, subject, html, { replyTo });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail de reativação enviado', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: true, status: 'enviado', message: 'E-mail enviado para o cliente.', logId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const friendly = errorMessage === 'RESEND_API_KEY_MISSING' ? 'Configuração do Resend ausente' : 'Falha ao enviar pelo provedor';
        await upsertLog(supabase, { ...baseLog, status: 'erro', subject, friendly_message: friendly, error_message: errorMessage, metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: false, status: 'erro', message: 'Não foi possível enviar o e-mail agora.', error: errorMessage });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. EVENTO: SELECTION_CONFIRMED (Cliente concluiu seleção)
    // ─────────────────────────────────────────────────────────────────────────────
    if (body.eventType === 'selection_confirmed') {
      if (!body.galleryId) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não informada' }, 400);

      const { data: gallery, error: galleryError } = await supabase
        .from('galerias')
        .select('id, user_id, cliente_id, cliente_nome, cliente_email, nome_sessao, permissao, public_token, prazo_selecao, total_fotos, fotos_selecionadas, total_fotos_extras_vendidas, valor_extras, finalized_at')
        .eq('id', body.galleryId)
        .maybeSingle();

      if (galleryError || !gallery) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não encontrada' }, 404);
      if (callerUserId !== 'service-role' && callerUserId !== gallery.user_id) {
        return jsonResponse({ success: false, status: 'erro', message: 'Sem permissão para esta galeria' }, 403);
      }

      let clienteNome = gallery.cliente_nome || 'Cliente';
      let clienteEmail = gallery.cliente_email || null;

      if (body.visitorId) {
        const { data: visitor } = await supabase
          .from('galeria_visitantes')
          .select('nome, email, fotos_selecionadas, finalized_at')
          .eq('id', body.visitorId)
          .maybeSingle();
        if (visitor) {
          if (visitor.nome) clienteNome = visitor.nome;
          if (visitor.email) clienteEmail = visitor.email;
        }
      }

      const finalKey = gallery.finalized_at || new Date().toISOString().slice(0, 16);
      const idempotencyKey = `selection_confirmed:${gallery.id}:${body.visitorId || 'owner'}:${finalKey}`;
      const sent = await alreadySent(supabase, idempotencyKey);
      if (sent) return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail de confirmação de seleção já enviado.', logId: sent.id });

      const [{ data: settings }, { data: ownerProfile }] = await Promise.all([
        supabase
          .from('gallery_settings')
          .select('*')
          .eq('user_id', gallery.user_id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('nome, empresa, logo_url, email')
          .eq('user_id', gallery.user_id)
          .maybeSingle(),
      ]);

      const baseLog = {
        user_id: gallery.user_id,
        cliente_id: gallery.cliente_id || null,
        cliente_nome: clienteNome,
        cliente_email: clienteEmail,
        event_type: 'selection_confirmed',
        gallery_id: gallery.id,
        payment_id: null,
        idempotency_key: idempotencyKey,
        metadata: { source: 'selection_confirmed', visitorId: body.visitorId || null },
        updated_at: new Date().toISOString(),
      };

      if (settings?.email_sending_enabled === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio automático desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mails automáticos estão desativados.' });
      }
      if (!clienteEmail) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Cliente sem e-mail cadastrado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Cliente não possui e-mail cadastrado.' });
      }

      const studioCandidate = (settings?.studio_name || '').trim();
      const companyCandidate = (ownerProfile?.empresa || '').trim();
      const nameCandidate = (ownerProfile?.nome || '').trim();
      const studioName = (studioCandidate && studioCandidate !== 'Meu Estúdio') ? studioCandidate : (companyCandidate || nameCandidate || 'Lunari');
      const studioLogoUrl = settings?.studio_logo_url || ownerProfile?.logo_url || null;

      const replyTo = await getPhotographerReplyTo(supabase, gallery.user_id);
      const token = body.publicToken || gallery.public_token;
      const galleryUrl = token ? `${GALLERY_BASE_URL}/g/${encodeURIComponent(token)}` : undefined;

      const { data: template } = await supabase
        .from('gallery_email_templates')
        .select('subject, body')
        .eq('user_id', gallery.user_id)
        .eq('type', 'selection_confirmed')
        .maybeSingle();

      const variables = {
        cliente: clienteNome,
        galeria: gallery.nome_sessao || 'Galeria',
        prazo: formatDateOnly(gallery.prazo_selecao),
        link: galleryUrl || '',
        estudio: studioName,
        total_fotos: String(gallery.fotos_selecionadas || 0),
        fotos_extras: String(gallery.total_fotos_extras_vendidas || 0),
        valor_extra: formatCurrency(gallery.valor_extras || 0),
      };

      const subject = replaceTemplateVariables(template?.subject || 'Seleção confirmada! - {galeria}', variables);
      const bodyText = replaceTemplateVariables(
        template?.body || 'Olá {cliente}!\n\nSua seleção da galeria "{galeria}" foi confirmada com sucesso!\n\nEm breve entraremos em contato.\n\nCom carinho,\n{estudio}',
        variables
      );

      const detailsList: DetailItem[] = [
        { label: 'Sessão', value: gallery.nome_sessao || 'Galeria', isBold: true },
        { label: 'Fotos selecionadas', value: `${gallery.fotos_selecionadas || 0} fotos`, isBold: true },
      ];
      if (gallery.total_fotos_extras_vendidas) {
        detailsList.push({ label: 'Fotos extras', value: `${gallery.total_fotos_extras_vendidas} fotos` });
      }

      const html = buildLayout({
        studioName,
        studioLogoUrl,
        title: subject,
        preview: 'Sua seleção de fotos foi confirmada com sucesso.',
        buttonUrl: galleryUrl,
        buttonText: 'Acessar Galeria',
        details: detailsList,
        children: `${textToHtmlParagraphs(bodyText)}`,
      });

      try {
        const resendMessageId = await sendResendEmail(clienteEmail, subject, html, { replyTo });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail de confirmação de seleção enviado', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: true, status: 'enviado', message: 'E-mail enviado para o cliente.', logId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const friendly = errorMessage === 'RESEND_API_KEY_MISSING' ? 'Configuração do Resend ausente' : 'Falha ao enviar pelo provedor';
        await upsertLog(supabase, { ...baseLog, status: 'erro', subject, friendly_message: friendly, error_message: errorMessage, metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: false, status: 'erro', message: 'Não foi possível enviar o e-mail agora.', error: errorMessage });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. EVENTO: SELECTION_REMINDER (Lembrete de prazo)
    // ─────────────────────────────────────────────────────────────────────────────
    if (body.eventType === 'selection_reminder') {
      if (!body.galleryId) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não informada' }, 400);

      const { data: gallery, error: galleryError } = await supabase
        .from('galerias')
        .select('id, user_id, cliente_id, cliente_nome, cliente_email, nome_sessao, public_token, prazo_selecao, total_fotos')
        .eq('id', body.galleryId)
        .maybeSingle();

      if (galleryError || !gallery) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não encontrada' }, 404);
      if (callerUserId !== 'service-role' && callerUserId !== gallery.user_id) {
        return jsonResponse({ success: false, status: 'erro', message: 'Sem permissão para esta galeria' }, 403);
      }

      const prazoKey = gallery.prazo_selecao ? new Date(String(gallery.prazo_selecao)).toISOString().slice(0, 10) : 'no_deadline';
      const idempotencyKey = `selection_reminder:${gallery.id}:${prazoKey}`;
      const sent = await alreadySent(supabase, idempotencyKey);
      if (sent) return jsonResponse({ success: true, status: 'ignorado', message: 'Lembrete já enviado para este prazo.', logId: sent.id });

      const [{ data: settings }, { data: ownerProfile }] = await Promise.all([
        supabase
          .from('gallery_settings')
          .select('*')
          .eq('user_id', gallery.user_id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('nome, empresa, logo_url, email')
          .eq('user_id', gallery.user_id)
          .maybeSingle(),
      ]);

      const baseLog = {
        user_id: gallery.user_id,
        cliente_id: gallery.cliente_id || null,
        cliente_nome: gallery.cliente_nome || null,
        cliente_email: gallery.cliente_email || null,
        event_type: 'selection_reminder',
        gallery_id: gallery.id,
        payment_id: null,
        idempotency_key: idempotencyKey,
        metadata: { source: 'selection_reminder', prazo_selecao: gallery.prazo_selecao },
        updated_at: new Date().toISOString(),
      };

      if (settings?.email_sending_enabled === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio automático desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mails automáticos estão desativados.' });
      }
      if (!gallery.cliente_email) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Cliente sem e-mail cadastrado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Cliente não possui e-mail cadastrado.' });
      }

      const token = body.publicToken || gallery.public_token;
      if (!token || token.length < 8) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Link da galeria indisponível' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Link da galeria indisponível.' });
      }

      const studioCandidate = (settings?.studio_name || '').trim();
      const companyCandidate = (ownerProfile?.empresa || '').trim();
      const nameCandidate = (ownerProfile?.nome || '').trim();
      const studioName = (studioCandidate && studioCandidate !== 'Meu Estúdio') ? studioCandidate : (companyCandidate || nameCandidate || 'Lunari');
      const studioLogoUrl = settings?.studio_logo_url || ownerProfile?.logo_url || null;

      const replyTo = await getPhotographerReplyTo(supabase, gallery.user_id);
      const galleryUrl = `${GALLERY_BASE_URL}/g/${encodeURIComponent(token)}`;
      const { data: template } = await supabase
        .from('gallery_email_templates')
        .select('subject, body')
        .eq('user_id', gallery.user_id)
        .eq('type', 'selection_reminder')
        .maybeSingle();

      const variables = {
        cliente: gallery.cliente_nome || 'Cliente',
        galeria: gallery.nome_sessao || 'Galeria',
        prazo: formatDateOnly(gallery.prazo_selecao),
        link: galleryUrl,
        estudio: studioName,
        dias_restantes: daysRemaining(gallery.prazo_selecao),
      };
      const subject = replaceTemplateVariables(template?.subject || 'Lembrete: Sua seleção expira em breve - {galeria}', variables);
      const bodyText = replaceTemplateVariables(template?.body || 'Olá {cliente}!\n\nEste é um lembrete amigável de que sua seleção da galeria "{galeria}" expira em {dias_restantes} dias.\n\nNão perca o prazo!\n\nCom carinho,\n{estudio}', variables);

      const detailsList: DetailItem[] = [
        { label: 'Sessão', value: gallery.nome_sessao || 'Galeria', isBold: true },
        { label: 'Prazo Limite', value: formatDateOnly(gallery.prazo_selecao), isBold: true },
        { label: 'Dias Restantes', value: `${variables.dias_restantes} dias` },
      ];

      const html = buildLayout({
        studioName,
        studioLogoUrl,
        title: subject,
        preview: `Sua seleção expira em ${variables.dias_restantes} dias.`,
        buttonUrl: galleryUrl,
        buttonText: 'Acessar Minha Galeria',
        details: detailsList,
        children: `${textToHtmlParagraphs(bodyText)}`,
      });

      try {
        const resendMessageId = await sendResendEmail(gallery.cliente_email, subject, html, { replyTo });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'Lembrete de seleção enviado', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: true, status: 'enviado', message: 'E-mail enviado para o cliente.', logId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const friendly = errorMessage === 'RESEND_API_KEY_MISSING' ? 'Configuração do Resend ausente' : 'Falha ao enviar pelo provedor';
        await upsertLog(supabase, { ...baseLog, status: 'erro', subject, friendly_message: friendly, error_message: errorMessage, metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: false, status: 'erro', message: 'Não foi possível enviar o e-mail agora.', error: errorMessage });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. EVENTO: PAYMENT_CONFIRMED (Confirmação de pagamento)
    // ─────────────────────────────────────────────────────────────────────────────
    if (body.eventType === 'payment_confirmed') {
      if (!body.paymentId) return jsonResponse({ success: false, status: 'erro', message: 'Pagamento não informado' }, 400);

      const { data: payment, error: paymentError } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('id', body.paymentId)
        .maybeSingle();

      if (paymentError || !payment) return jsonResponse({ success: false, status: 'erro', message: 'Pagamento não encontrado' }, 404);
      if (callerUserId !== 'service-role' && callerUserId !== payment.user_id) {
        return jsonResponse({ success: false, status: 'erro', message: 'Sem permissão para enviar e-mail deste pagamento' }, 403);
      }

      const idempotencyKey = `payment_confirmed:${payment.id}`;
      const sent = await alreadySent(supabase, idempotencyKey);
      if (sent) return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail já enviado anteriormente.', logId: sent.id });

      const [{ data: settings }, { data: ownerProfile }, { data: client }, { data: gallery }] = await Promise.all([
        supabase.from('gallery_settings').select('*').eq('user_id', payment.user_id).maybeSingle(),
        supabase.from('profiles').select('nome, empresa, logo_url, email').eq('user_id', payment.user_id).maybeSingle(),
        payment.cliente_id ? supabase.from('clientes').select('id, nome, email').eq('id', payment.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
        payment.galeria_id ? supabase.from('galerias').select('id, cliente_nome, cliente_email, nome_sessao, public_token').eq('id', payment.galeria_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      const clienteNome = client?.nome || gallery?.cliente_nome || 'Cliente';
      const clienteEmail = client?.email || gallery?.cliente_email || null;
      const baseLog = {
        user_id: payment.user_id,
        cliente_id: payment.cliente_id || client?.id || null,
        cliente_nome: clienteNome,
        cliente_email: clienteEmail,
        event_type: 'payment_confirmed',
        gallery_id: payment.galeria_id || null,
        payment_id: payment.id,
        idempotency_key: idempotencyKey,
        metadata: { provider: payment.provedor, chargeType: payment.tipo_cobranca },
        updated_at: new Date().toISOString(),
      };

      if (payment.status !== 'pago' && payment.status !== 'pago_manual') {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Pagamento ainda não confirmado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Pagamento ainda não confirmado.' });
      }
      if (settings?.email_sending_enabled === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio automático desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mails automáticos estão desativados.' });
      }
      if (settings?.email_on_payment_confirmed === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Confirmação de pagamento desativada' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail de pagamento desativado.' });
      }
      if (!clienteEmail) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Cliente sem e-mail cadastrado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Cliente não possui e-mail cadastrado.' });
      }

      const studioCandidate = (settings?.studio_name || '').trim();
      const companyCandidate = (ownerProfile?.empresa || '').trim();
      const nameCandidate = (ownerProfile?.nome || '').trim();
      const studioName = (studioCandidate && studioCandidate !== 'Meu Estúdio') ? studioCandidate : (companyCandidate || nameCandidate || 'Lunari');
      const studioLogoUrl = settings?.studio_logo_url || ownerProfile?.logo_url || null;

      const replyTo = await getPhotographerReplyTo(supabase, payment.user_id);
      const galleryUrl = gallery?.public_token ? `${GALLERY_BASE_URL}/g/${encodeURIComponent(gallery.public_token)}` : undefined;
      const subject = 'Pagamento confirmado ✨';
      const description = payment.descricao || (payment.qtd_fotos ? `${payment.qtd_fotos} foto(s) extra(s)` : 'Pagamento da galeria');

      const detailsList: DetailItem[] = [
        { label: 'Valor pago', value: formatCurrency(payment.valor), isBold: true },
        { label: 'Forma de pagamento', value: paymentMethodLabel(payment) },
        { label: 'Data', value: formatDate(payment.data_pagamento) },
        { label: 'Descrição', value: description },
        { label: 'Status', value: 'Confirmado', isBold: true },
      ];

      const html = buildLayout({
        studioName,
        studioLogoUrl,
        title: 'Pagamento confirmado',
        preview: `Recebemos a confirmação do seu pagamento de ${formatCurrency(payment.valor)}.`,
        buttonUrl: galleryUrl,
        buttonText: 'Acessar Galeria',
        details: detailsList,
        children: `
          <p style="margin:0 0 16px;color:#2D2A26;font-size:15px;line-height:1.7;">Olá, ${escapeHtml(clienteNome)}.</p>
          <p style="margin:0 0 16px;color:#2D2A26;font-size:15px;line-height:1.7;">Recebemos a confirmação do seu pagamento com sucesso. Muito obrigado!</p>
        `,
      });

      try {
        const resendMessageId = await sendResendEmail(clienteEmail, subject, html, { replyTo });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail de confirmação de pagamento enviado', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: true, status: 'enviado', message: 'E-mail enviado para o cliente.', logId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const friendly = errorMessage === 'RESEND_API_KEY_MISSING' ? 'Configuração do Resend ausente' : 'Falha ao enviar pelo provedor';
        await upsertLog(supabase, { ...baseLog, status: 'erro', subject, friendly_message: friendly, error_message: errorMessage, metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: false, status: 'erro', message: 'Não foi possível enviar o e-mail agora.', error: errorMessage });
      }
    }

    return jsonResponse({ success: false, status: 'erro', message: 'Evento não tratado' }, 400);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('send-email fatal error:', error);
    return jsonResponse({ success: false, status: 'erro', message: 'Erro interno ao processar e-mail', details: errorMessage }, 500);
  }
});
