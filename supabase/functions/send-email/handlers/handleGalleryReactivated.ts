import { EventHandlerContext, DetailItem } from '../types.ts';
import {
  jsonResponse,
  alreadySent,
  upsertLog,
  getPhotographerReplyTo,
  formatDateOnly,
  daysRemaining,
  formatCurrency,
  replaceTemplateVariables,
  textToHtmlParagraphs,
  GALLERY_BASE_URL,
} from '../helpers.ts';
import { buildLayout } from '../templates/baseLayout.ts';
import { sendResendEmail } from '../resendClient.ts';

export async function handleGalleryReactivated(ctx: EventHandlerContext): Promise<Response> {
  const { supabase, callerUserId, body } = ctx;

  if (!body.galleryId) {
    return jsonResponse({ success: false, status: 'erro', message: 'Galeria não informada' }, 400);
  }

  const { data: gallery, error: galleryError } = await supabase
    .from('galerias')
    .select('id, user_id, cliente_id, cliente_nome, cliente_email, nome_sessao, permissao, gallery_password, public_token, prazo_selecao, total_fotos, fotos_selecionadas, total_fotos_extras_vendidas, valor_extras')
    .eq('id', body.galleryId)
    .maybeSingle();

  if (galleryError || !gallery) {
    return jsonResponse({ success: false, status: 'erro', message: 'Galeria não encontrada' }, 404);
  }

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
    if (sent) {
      return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail já enviado para esta reativação.', logId: sent.id });
    }
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
