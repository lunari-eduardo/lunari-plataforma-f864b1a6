import { EventHandlerContext, DetailItem } from '../types.ts';
import {
  jsonResponse,
  alreadySent,
  upsertLog,
  isValidEmail,
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

export async function handleGallerySent(ctx: EventHandlerContext): Promise<Response> {
  const { supabase, callerUserId, body } = ctx;

  if (!body.galleryId) {
    return jsonResponse({ success: false, status: 'erro', message: 'Galeria não informada' }, 400);
  }

  const { data: gallery, error: galleryError } = await supabase
    .from('galerias')
    .select('id, user_id, tipo, cliente_id, cliente_nome, cliente_email, nome_sessao, permissao, gallery_password, public_token, prazo_selecao, total_fotos, fotos_selecionadas, total_fotos_extras_vendidas, valor_extras, theme_id, use_custom_theme, theme_overrides')
    .eq('id', body.galleryId)
    .maybeSingle();

  if (galleryError || !gallery) {
    return jsonResponse({ success: false, status: 'erro', message: 'Galeria não encontrada' }, 404);
  }

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
    if (sent) {
      return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail já enviado anteriormente.', logId: sent.id });
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
