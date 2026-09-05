import { EventHandlerContext, DetailItem } from '../types.ts';
import {
  jsonResponse,
  alreadySent,
  upsertLog,
  escapeHtml,
  getPhotographerReplyTo,
  formatDate,
  formatDateOnly,
  formatCurrency,
  replaceTemplateVariables,
  textToHtmlParagraphs,
  GALLERY_BASE_URL,
} from '../helpers.ts';
import { buildLayout } from '../templates/baseLayout.ts';
import { sendResendEmail } from '../resendClient.ts';
import { generateSummaryPdf } from '../pdfGenerator.ts';

export async function handleSelectionConfirmed(ctx: EventHandlerContext): Promise<Response> {
  const { supabase, callerUserId, body } = ctx;

  if (!body.galleryId) {
    return jsonResponse({ success: false, status: 'erro', message: 'Galeria não informada' }, 400);
  }

  const { data: gallery, error: galleryError } = await supabase
    .from('galerias')
    .select('id, user_id, cliente_id, cliente_nome, cliente_email, nome_sessao, permissao, public_token, prazo_selecao, total_fotos, fotos_incluidas, fotos_selecionadas, total_fotos_extras_vendidas, valor_foto_extra, valor_extras, finalized_at')
    .eq('id', body.galleryId)
    .maybeSingle();

  if (galleryError || !gallery) {
    return jsonResponse({ success: false, status: 'erro', message: 'Galeria não encontrada' }, 404);
  }

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
  if (sent) {
    return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail de confirmação de seleção já enviado.', logId: sent.id });
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

  let clientLogId: string | null = null;
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
