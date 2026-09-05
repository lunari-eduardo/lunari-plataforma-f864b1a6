import { EventHandlerContext, DetailItem } from '../types.ts';
import {
  jsonResponse,
  alreadySent,
  upsertLog,
  getPhotographerReplyTo,
  formatDate,
  formatCurrency,
  replaceTemplateVariables,
  textToHtmlParagraphs,
  paymentMethodLabel,
  GALLERY_BASE_URL,
} from '../helpers.ts';
import { buildLayout } from '../templates/baseLayout.ts';
import { sendResendEmail } from '../resendClient.ts';

export async function handlePaymentConfirmed(ctx: EventHandlerContext): Promise<Response> {
  const { supabase, callerUserId, body } = ctx;

  if (!body.paymentId) {
    return jsonResponse({ success: false, status: 'erro', message: 'Pagamento não informado' }, 400);
  }

  const { data: payment, error: paymentError } = await supabase
    .from('cobrancas')
    .select('*')
    .eq('id', body.paymentId)
    .maybeSingle();

  if (paymentError || !payment) {
    return jsonResponse({ success: false, status: 'erro', message: 'Pagamento não encontrado' }, 404);
  }

  if (callerUserId !== 'service-role' && callerUserId !== payment.user_id) {
    return jsonResponse({ success: false, status: 'erro', message: 'Sem permissão para enviar e-mail deste pagamento' }, 403);
  }

  const idempotencyKey = `payment_confirmed:${payment.id}`;
  const sent = await alreadySent(supabase, idempotencyKey);
  if (sent) {
    return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail já enviado anteriormente.', logId: sent.id });
  }

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
