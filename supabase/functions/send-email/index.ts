import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FROM_EMAIL = 'Lunari <contato@mail.lunarihub.com>';
const GALLERY_BASE_URL = 'https://app.lunarihub.com';
const RESEND_API_URL = 'https://api.resend.com/emails';

type EventType = 'gallery_sent' | 'payment_confirmed' | 'gallery_reactivated' | 'selection_confirmed' | 'selection_reminder' | 'summary_sent';

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
  const primaryColor = params.primaryColor || '#C6A36A';
  
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
          <a href="${escapeHtml(params.buttonUrl)}" style="display:inline-block;background-color:${escapeHtml(primaryColor)};color:#FFFFFF;text-decoration:none;font-weight:500;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;border-radius:6px;padding:16px 36px;box-shadow:0 4px 14px rgba(0,0,0,0.08);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
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
  <body style="margin:0;background-color:#F5F4F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2D2A26;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preview)}</div>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background-color:#F5F4F0;padding:40px 16px 48px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;background:#FFFFFF;border:1px solid #E8E3DC;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.04);overflow:hidden;">
            <tr>
              <td style="padding:44px 36px 36px;">
                ${headerContent}
                ${badgeHtml}
                <h1 style="margin:0 0 22px;color:#1C1917;font-size:24px;line-height:1.3;font-weight:400;text-align:center;font-family:Georgia,'Times New Roman',serif;">
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

function uint8ToBase64(u8Arr: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  const length = u8Arr.length;
  let result = '';
  let slice;
  for (let i = 0; i < length; i += CHUNK_SIZE) {
    slice = u8Arr.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return btoa(result);
}

async function fetchAndEmbedImage(pdfDoc: any, url: string): Promise<any | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    try {
      return await pdfDoc.embedJpg(bytes);
    } catch {
      try {
        return await pdfDoc.embedPng(bytes);
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
}

async function fetchAndEmbedBatch(pdfDoc: any, photos: any[], batchSize = 5): Promise<(any | null)[]> {
  const results: (any | null)[] = [];
  for (let i = 0; i < photos.length; i += batchSize) {
    const batch = photos.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((photo) => {
        const thumbKey = photo.thumb_path || photo.preview_path || photo.storage_key;
        if (!thumbKey) return Promise.resolve(null);
        const url = thumbKey.startsWith('http') ? thumbKey : `https://media.lunarihub.com/${thumbKey}`;
        return fetchAndEmbedImage(pdfDoc, url);
      })
    );
    results.push(...batchResults);
  }
  return results;
}

function drawPlaceholderBox(page: any, x: number, y: number, size: number, font: any) {
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: rgb(0.96, 0.95, 0.94),
    borderColor: rgb(0.88, 0.86, 0.83),
    borderWidth: 1,
  });
  page.drawText('Foto', {
    x: x + size / 2 - 8,
    y: y + size / 2 - 3,
    size: 7,
    font,
    color: rgb(0.55, 0.55, 0.55),
  });
}

function drawPhotoListItem(
  page: any,
  photo: any,
  img: any,
  x: number,
  y: number,
  width: number,
  height: number,
  thumbSize: number,
  index: number,
  font: any,
  boldFont: any
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.92, 0.90, 0.87),
    borderWidth: 1,
  });

  const thumbX = x + 4;
  const thumbY = y + (height - thumbSize) / 2;

  if (img) {
    try {
      const scale = Math.min(thumbSize / img.width, thumbSize / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offX = (thumbSize - drawW) / 2;
      const offY = (thumbSize - drawH) / 2;
      page.drawImage(img, {
        x: thumbX + offX,
        y: thumbY + offY,
        width: drawW,
        height: drawH,
      });
    } catch {
      drawPlaceholderBox(page, thumbX, thumbY, thumbSize, font);
    }
  } else {
    drawPlaceholderBox(page, thumbX, thumbY, thumbSize, font);
  }

  const textX = thumbX + thumbSize + 10;
  const filename = photo.original_filename || photo.filename || `Foto ${index}`;
  const truncatedFilename = filename.length > 26 ? filename.slice(0, 24) + '...' : filename;

  page.drawText(`#${index}`, {
    x: textX,
    y: y + height - 16,
    size: 8,
    font: boldFont,
    color: rgb(0.77, 0.64, 0.41),
  });

  page.drawText(truncatedFilename, {
    x: textX,
    y: y + height - 32,
    size: 9,
    font: boldFont,
    color: rgb(0.15, 0.14, 0.13),
  });
}

async function generateSummaryPdf(
  supabase: any,
  gallery: any,
  selectedPhotos: any[],
  studioName: string,
  studioLogoUrl?: string | null
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let currentY = pageHeight - margin;

  // 1. Header (Estúdio & Título)
  page.drawText(studioName, {
    x: margin,
    y: currentY - 14,
    size: 11,
    font: boldFont,
    color: rgb(0.77, 0.64, 0.41),
  });

  const dateStr = formatDate(gallery.finalized_at || new Date());
  page.drawText(`Confirmação em: ${dateStr}`, {
    x: pageWidth - margin - 170,
    y: currentY - 14,
    size: 9,
    font,
    color: rgb(0.45, 0.43, 0.40),
  });

  currentY -= 30;

  page.drawText('Resumo da Seleção de Fotos', {
    x: margin,
    y: currentY - 18,
    size: 20,
    font: boldFont,
    color: rgb(0.11, 0.10, 0.09),
  });

  currentY -= 32;

  page.drawLine({
    start: { x: margin, y: currentY },
    end: { x: pageWidth - margin, y: currentY },
    thickness: 1,
    color: rgb(0.90, 0.88, 0.85),
  });

  currentY -= 15;

  // 2. Quadro de Métricas da Seleção (Sem status de pagamento)
  const cardHeight = 78;
  page.drawRectangle({
    x: margin,
    y: currentY - cardHeight,
    width: contentWidth,
    height: cardHeight,
    color: rgb(0.97, 0.97, 0.96),
    borderColor: rgb(0.91, 0.89, 0.86),
    borderWidth: 1,
  });

  const cardY = currentY - 18;
  page.drawText('Galeria:', { x: margin + 14, y: cardY, size: 9, font: boldFont, color: rgb(0.45, 0.43, 0.40) });
  page.drawText(gallery.nome_sessao || 'Sem nome', { x: margin + 60, y: cardY, size: 9, font: boldFont, color: rgb(0.11, 0.10, 0.09) });

  page.drawText('Cliente:', { x: margin + 14, y: cardY - 16, size: 9, font: boldFont, color: rgb(0.45, 0.43, 0.40) });
  const clientInfoStr = `${gallery.cliente_nome || 'Não informado'}${gallery.cliente_email ? ` (${gallery.cliente_email})` : ''}`;
  page.drawText(clientInfoStr.length > 45 ? clientInfoStr.slice(0, 45) + '...' : clientInfoStr, { x: margin + 60, y: cardY - 16, size: 9, font, color: rgb(0.11, 0.10, 0.09) });

  const metricsY = cardY - 44;
  const colW = contentWidth / 4;

  const metrics = [
    { label: 'FOTOS INCLUÍDAS', val: String(gallery.fotos_incluidas || 0) },
    { label: 'SELECIONADAS', val: String(gallery.fotos_selecionadas || 0) },
    { label: 'FOTOS EXTRAS', val: String(gallery.total_fotos_extras_vendidas || 0) },
    { label: 'VALOR EXTRA', val: formatCurrency(gallery.valor_extras || 0) },
  ];

  metrics.forEach((m, idx) => {
    const mx = margin + idx * colW + 14;
    page.drawText(m.label, { x: mx, y: metricsY + 12, size: 7.5, font: boldFont, color: rgb(0.55, 0.52, 0.48) });
    page.drawText(m.val, { x: mx, y: metricsY, size: 11, font: boldFont, color: rgb(0.11, 0.10, 0.09) });
  });

  currentY -= (cardHeight + 20);

  // 3. Lista de Fotos Selecionadas com Previews
  page.drawText(`Fotos Selecionadas (${selectedPhotos.length})`, {
    x: margin,
    y: currentY - 14,
    size: 13,
    font: boldFont,
    color: rgb(0.11, 0.10, 0.09),
  });

  currentY -= 26;

  const colWidth = (contentWidth - 16) / 2;
  const itemHeight = 56;
  const thumbSize = 48;

  const embeddedImages = await fetchAndEmbedBatch(pdfDoc, selectedPhotos, 5);

  for (let i = 0; i < selectedPhotos.length; i += 2) {
    if (currentY - itemHeight < 50) {
      page = pdfDoc.addPage([595.28, 841.89]);
      currentY = pageHeight - margin - 20;

      page.drawText(`Resumo da Seleção - ${gallery.nome_sessao || ''} (Continuação)`, {
        x: margin,
        y: currentY,
        size: 9,
        font: boldFont,
        color: rgb(0.55, 0.52, 0.48),
      });
      page.drawLine({
        start: { x: margin, y: currentY - 8 },
        end: { x: pageWidth - margin, y: currentY - 8 },
        thickness: 0.5,
        color: rgb(0.90, 0.88, 0.85),
      });
      currentY -= 28;
    }

    const itemY = currentY - itemHeight;

    const photo1 = selectedPhotos[i];
    const img1 = embeddedImages[i];
    drawPhotoListItem(page, photo1, img1, margin, itemY, colWidth, itemHeight, thumbSize, i + 1, font, boldFont);

    if (i + 1 < selectedPhotos.length) {
      const photo2 = selectedPhotos[i + 1];
      const img2 = embeddedImages[i + 1];
      drawPhotoListItem(page, photo2, img2, margin + colWidth + 16, itemY, colWidth, itemHeight, thumbSize, i + 2, font, boldFont);
    }

    currentY -= (itemHeight + 10);
  }

  // 4. Rodapé e numeração de páginas
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    p.drawText(`Página ${i + 1} de ${totalPages}  •  Lunari Studio`, {
      x: pageWidth / 2 - 50,
      y: 20,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return uint8ToBase64(pdfBytes);
}

async function sendResendEmail(to: string, subject: string, html: string, options: { replyTo?: string | null; fromName?: string | null; attachments?: any[] } = {}) {
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
        subject = `Suas fotos finais estão prontas para download - ${gallery.nome_sessao || 'Galeria'}`;
      } else {
        subject = replaceTemplateVariables(template?.subject || 'Suas fotos já estão prontas', variables);
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
        const resendMessageId = await sendResendEmail(targetEmail, subject, html, { replyTo, fromName: studioName });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail de entrega enviado para o cliente', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo), fromName: studioName } });
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
        const resendMessageId = await sendResendEmail(gallery.cliente_email, subject, html, { replyTo, fromName: studioName });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail de reativação enviado', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo), fromName: studioName } });
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
        .select('id, user_id, cliente_id, cliente_nome, cliente_email, nome_sessao, permissao, public_token, prazo_selecao, total_fotos, fotos_incluidas, fotos_selecionadas, total_fotos_extras_vendidas, valor_foto_extra, valor_extras, finalized_at')
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

      let clientLogId;
      if (settings?.email_on_selection_confirmed !== false) {
        try {
          const resendMessageId = await sendResendEmail(clienteEmail, subject, html, { replyTo, fromName: studioName });
          clientLogId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail de confirmação de seleção enviado', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo), fromName: studioName } });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const friendly = errorMessage === 'RESEND_API_KEY_MISSING' ? 'Configuração do Resend ausente' : 'Falha ao enviar pelo provedor';
          await upsertLog(supabase, { ...baseLog, status: 'erro', subject, friendly_message: friendly, error_message: errorMessage, metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        }
      } else {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio de confirmação de seleção para o cliente desativado' });
      }

      if (settings?.email_summary_to_photographer !== false) {
        const photogEmail = ownerProfile?.email || replyTo;
        if (photogEmail) {
          try {
            const photogIdempotencyKey = `summary_sent:${gallery.id}:${finalKey}`;
            const sentSummary = await alreadySent(supabase, photogIdempotencyKey);
            if (!sentSummary) {
              let selectedPhotos: any[] = [];
              if (body.visitorId) {
                const { data: visitorSelections } = await supabase
                  .from('visitante_selecoes')
                  .select('foto_id')
                  .eq('visitante_id', body.visitorId);

                const photoIds = (visitorSelections || []).map((s: any) => s.foto_id).filter(Boolean);
                if (photoIds.length > 0) {
                  const { data: photos } = await supabase
                    .from('galeria_fotos')
                    .select('id, filename, original_filename, thumb_path, preview_path, storage_key, order_index')
                    .in('id', photoIds)
                    .order('order_index', { ascending: true });
                  selectedPhotos = photos || [];
                }
              } else {
                const { data: photos } = await supabase
                  .from('galeria_fotos')
                  .select('id, filename, original_filename, thumb_path, preview_path, storage_key, order_index')
                  .eq('galeria_id', gallery.id)
                  .eq('is_selected', true)
                  .order('order_index', { ascending: true });
                selectedPhotos = photos || [];
              }

              const pdfBase64 = await generateSummaryPdf(supabase, gallery, selectedPhotos, studioName, studioLogoUrl);
              const safeSessionName = (gallery.nome_sessao || 'galeria').replace(/[^a-zA-Z0-9_-]/g, '_');
              const attachments = [{ filename: `resumo_selecao_${safeSessionName}.pdf`, content: pdfBase64 }];
              const photogSubject = `Resumo de Seleção Confirmada - ${gallery.nome_sessao}`;

              const photogDetailsList: DetailItem[] = [
                { label: 'Sessão', value: gallery.nome_sessao || 'Galeria', isBold: true },
                { label: 'Cliente', value: `${clienteNome}${clienteEmail ? ` (${clienteEmail})` : ''}` },
                { label: 'Data da Confirmação', value: formatDate(gallery.finalized_at || new Date()) },
                { label: 'Fotos incluídas no pacote', value: `${gallery.fotos_incluidas || 0} fotos` },
                { label: 'Fotos selecionadas pelo cliente', value: `${gallery.fotos_selecionadas || 0} fotos`, isBold: true },
                { label: 'Fotos extras', value: `${gallery.total_fotos_extras_vendidas || 0} fotos` },
                { label: 'Valor extra total', value: formatCurrency(gallery.valor_extras || 0), isBold: true },
              ];

              const photogBodyParagraphs = `<p style="margin:0 0 16px;color:#2D2A26;font-size:15px;line-height:1.7;">Olá <strong>${escapeHtml(nameCandidate || 'Fotógrafo')}</strong>,</p>
<p style="margin:0 0 16px;color:#2D2A26;font-size:15px;line-height:1.7;">O cliente <strong>${escapeHtml(clienteNome)}</strong> concluiu e confirmou a seleção de fotos da galeria <strong>${escapeHtml(gallery.nome_sessao)}</strong>.</p>
<p style="margin:0 0 16px;color:#2D2A26;font-size:15px;line-height:1.7;">As informações principais da seleção estão resumidas abaixo. Em anexo a este e-mail, você encontra o <strong>relatório em PDF completo</strong> contendo a lista e as miniaturas (previews) de todas as fotos selecionadas.</p>`;

              const photogHtml = buildLayout({
                studioName,
                studioLogoUrl,
                title: photogSubject,
                preview: `Seleção concluída por ${clienteNome} - ${gallery.nome_sessao}`,
                badgeText: 'SELEÇÃO CONCLUÍDA',
                details: photogDetailsList,
                buttonUrl: galleryUrl,
                buttonText: 'Acessar Galeria',
                children: photogBodyParagraphs,
              });

              const resendMessageId = await sendResendEmail(photogEmail, photogSubject, photogHtml, { fromName: studioName, attachments });

              await upsertLog(supabase, { 
                ...baseLog, 
                event_type: 'summary_sent', 
                idempotency_key: photogIdempotencyKey, 
                status: 'enviado', 
                subject: photogSubject, 
                resend_message_id: resendMessageId, 
                friendly_message: 'Resumo com PDF e previews enviado ao fotógrafo',
                metadata: { ...baseLog.metadata, target: photogEmail }
              });
            }
          } catch (err) {
            console.error('Erro ao enviar resumo para o fotógrafo:', err);
          }
        }
      }

      return jsonResponse({ success: true, status: 'processado', message: 'Processamento de seleção confirmada concluído.', logId: clientLogId });
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
      if (settings?.email_on_selection_reminder === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Lembrete de seleção desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail de lembrete de seleção está desativado.' });
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
        const resendMessageId = await sendResendEmail(gallery.cliente_email, subject, html, { replyTo, fromName: studioName });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'Lembrete de seleção enviado', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo), fromName: studioName } });
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

      const { data: template } = await supabase
        .from('gallery_email_templates')
        .select('subject, body')
        .eq('user_id', payment.user_id)
        .eq('type', 'payment_confirmed')
        .maybeSingle();

      const variables = {
        cliente: clienteNome,
        galeria: gallery?.nome_sessao || 'Galeria',
        link: galleryUrl || '',
        estudio: studioName,
        valor: formatCurrency(payment.valor),
      };

      const subject = template?.subject ? replaceTemplateVariables(template.subject, variables) : 'Pagamento confirmado ✨';
      const bodyText = template?.body 
        ? replaceTemplateVariables(template.body, variables)
        : `Olá, ${clienteNome}.\n\nRecebemos a confirmação do seu pagamento com sucesso. Muito obrigado!\n\nCom carinho,\n${studioName}`;

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
        title: subject,
        preview: `Recebemos a confirmação do seu pagamento de ${formatCurrency(payment.valor)}.`,
        buttonUrl: galleryUrl,
        buttonText: 'Acessar Galeria',
        details: detailsList,
        children: textToHtmlParagraphs(bodyText),
      });

      try {
        const resendMessageId = await sendResendEmail(clienteEmail, subject, html, { replyTo, fromName: studioName });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail de confirmação de pagamento enviado', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo), fromName: studioName } });
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
