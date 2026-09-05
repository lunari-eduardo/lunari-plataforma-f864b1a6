import { syncSessionOnFinalize } from '../_shared/session-sync.ts';
import { corsHeaders, successResponse, errorResponse } from '../_shared/responses.ts';

export async function finalizeSelectionAndRespond(params: {
  supabase: any;
  gallery: any;
  galleryId: string;
  galleryToken: string;
  visitorId?: string;
  selectedCount: number;
  extrasCount: number;
  valorTotal: number;
  valorUnitario: number;
  extrasACobrar: number;
  shouldCreatePayment: boolean;
  paymentResponse: any;
  statusPagamento: string;
  saleMode: string;
  clientIp: string;
  correlationId: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  userAgent?: string | null;
  rollbackGalleryStatus: () => Promise<void>;
}): Promise<Response> {
  const {
    supabase,
    gallery,
    galleryId,
    galleryToken,
    visitorId,
    selectedCount,
    extrasCount,
    valorTotal,
    valorUnitario,
    extrasACobrar,
    shouldCreatePayment,
    paymentResponse,
    statusPagamento,
    saleMode,
    clientIp,
    correlationId,
    supabaseUrl,
    supabaseServiceKey,
    userAgent,
    rollbackGalleryStatus,
  } = params;

  if (visitorId) {
    // ── PUBLIC GALLERY: Update visitor ──
    const visitorUpdateData: Record<string, unknown> = {
      status: 'finalizado',
      status_selecao: shouldCreatePayment ? 'aguardando_pagamento' : 'selecao_completa',
      fotos_selecionadas: selectedCount || 0,
      finalized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: visitorUpdateError } = await supabase
      .from('galeria_visitantes')
      .update(visitorUpdateData)
      .eq('id', visitorId);

    if (visitorUpdateError) {
      console.error('Visitor update error:', visitorUpdateError);
      await rollbackGalleryStatus();
      return new Response(
        JSON.stringify({ error: 'Erro ao confirmar seleção' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentResponse?.provedor === 'pix_manual') {
      const integracaoPixManual = await supabase
        .from('usuarios_integracoes')
        .select('dados_extras')
        .eq('user_id', gallery.user_id)
        .eq('provedor', 'pix_manual')
        .eq('status', 'ativo')
        .maybeSingle();
      if (integracaoPixManual.data) {
        await supabase.from('galerias').update({
          configuracoes: { ...gallery.configuracoes, pixDados: integracaoPixManual.data.dados_extras },
        }).eq('id', galleryId);
      }
    }

    console.log(`✅ Visitor ${visitorId} selection confirmed: ${selectedCount} photos`);
  } else {
    // ── PRIVATE GALLERY: Update gallery directly ──
    const updateData: Record<string, unknown> = {
      status: 'selecao_completa',
      status_selecao: shouldCreatePayment ? 'aguardando_pagamento' : 'selecao_completa',
      finalized_at: new Date().toISOString(),
      fotos_selecionadas: selectedCount || 0,
      valor_extras: valorTotal,
      status_pagamento: statusPagamento,
      updated_at: new Date().toISOString(),
    };

    if (paymentResponse?.provedor === 'pix_manual') {
      const integracao = await supabase
        .from('usuarios_integracoes')
        .select('dados_extras')
        .eq('user_id', gallery.user_id)
        .eq('provedor', 'pix_manual')
        .eq('status', 'ativo')
        .maybeSingle();
      if (integracao.data) {
        updateData.configuracoes = { ...gallery.configuracoes, pixDados: integracao.data.dados_extras };
      }
    }

    const { error: updateError } = await supabase
      .from('galerias')
      .update(updateData)
      .eq('id', galleryId);

    if (updateError) {
      console.error('Gallery update error:', updateError);
      await rollbackGalleryStatus();
      return new Response(
        JSON.stringify({ error: 'Erro ao confirmar seleção' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Background non-blocking tasks
  const backgroundTasks = async () => {
    try {
      const { error: logError } = await supabase.from('galeria_acoes').insert({
        galeria_id: galleryId,
        tipo: 'cliente_confirmou',
        descricao: `Cliente confirmou seleção de ${selectedCount || 0} fotos` + (extrasACobrar ? ` (${extrasACobrar} extras - R$ ${valorTotal.toFixed(2)})` : ''),
        user_id: null,
      });
      if (logError) console.error('[bg] Log insert error:', logError);
    } catch (e) { console.error('[bg] galeria_acoes insert exc:', e); }

    if (gallery.session_id) {
      try {
        const syncResult = await syncSessionOnFinalize({
          supabase,
          galleryId,
          sessionId: gallery.session_id,
          correlationId,
        });
        if (!syncResult.ok && !syncResult.skipped) {
          console.warn(`[bg] ⚠️ gallery-update-session-photos falhou (status=${syncResult.status}): ${JSON.stringify(syncResult.body)} — trigger cobre o estado`);
        } else if (syncResult.ok && !syncResult.skipped) {
          console.log(`[bg] ✅ Sessão ${gallery.session_id} sincronizada via edge Gestão`);
        }
      } catch (e) { console.error('[bg] syncSessionOnFinalize exc:', e); }
    }

    try {
      const { error: auditErr } = await supabase.from('audit_log').insert({
        action: 'confirm_selection',
        actor_type: 'client',
        ip_address: clientIp,
        resource_type: 'gallery',
        resource_id: galleryId,
        gallery_id: galleryId,
        user_agent: userAgent || null,
        metadata: {
          selectedCount,
          extrasACobrar,
          valorTotal,
          valorUnitario,
          paymentRequired: shouldCreatePayment,
          provedor: paymentResponse?.provedor || null,
        },
      });
      if (auditErr) console.warn('[bg] Audit log error:', auditErr.message);
    } catch (e) { console.error('[bg] audit_log insert exc:', e); }

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          eventType: 'selection_confirmed',
          galleryId,
          visitorId: visitorId || undefined,
          publicToken: galleryToken,
        }),
      });
    } catch (emailErr) {
      console.warn('[bg] Erro ao disparar send-email selection_confirmed:', emailErr);
    }
  };

  const bgPromise = backgroundTasks();
  // @ts-ignore
  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
    // @ts-ignore
    EdgeRuntime.waitUntil(bgPromise);
  } else {
    bgPromise.catch((e) => console.error('[bg] tasks failed:', e));
  }

  console.log(`✅ Gallery ${galleryId} selection confirmed with ${selectedCount} photos, status_pagamento=${statusPagamento}`);

  if (shouldCreatePayment && (!paymentResponse || (!paymentResponse.checkoutUrl && paymentResponse.provedor !== 'pix_manual' && paymentResponse.provedor !== 'asaas' && paymentResponse.provedor !== 'mercadopago'))) {
    console.error(`❌ CRITICAL: Payment was required (R$ ${valorTotal}) but no checkout link was generated. Provider: ${paymentResponse?.provedor || 'none'}, Mode: ${saleMode}`);
    await rollbackGalleryStatus();
    return errorResponse('Erro ao gerar link de pagamento. Por favor, tente novamente ou entre em contato com o suporte.', 500, 'PAYMENT_LINK_FAILED');
  }

  if (paymentResponse?.provedor === 'pix_manual') {
    const integracao = await supabase
      .from('usuarios_integracoes')
      .select('dados_extras')
      .eq('user_id', gallery.user_id)
      .eq('provedor', 'pix_manual')
      .eq('status', 'ativo')
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        selectedCount,
        extraCount: extrasCount,
        valorUnitario,
        valorTotal,
        message: 'Seleção confirmada com sucesso',
        requiresPayment: true,
        paymentMethod: 'pix_manual',
        pixData: integracao.data?.dados_extras,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const asaasCheckoutData = (paymentResponse as Record<string, unknown> | null)?.__asaasCheckoutData;
  if ((paymentResponse?.provedor === 'asaas' || paymentResponse?.provedor === 'mercadopago') && asaasCheckoutData) {
    return new Response(
      JSON.stringify({
        success: true,
        selectedCount,
        extraCount: extrasCount,
        valorUnitario,
        valorTotal,
        message: 'Seleção confirmada com sucesso',
        requiresPayment: true,
        provedor: paymentResponse.provedor,
        transparentCheckout: true,
        asaasCheckoutData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return successResponse({
    success: true,
    selectedCount,
    extraCount: extrasCount,
    valorUnitario,
    valorTotal,
    message: 'Seleção confirmada com sucesso',
    requiresPayment: !!paymentResponse,
    checkoutUrl: paymentResponse?.checkoutUrl,
    provedor: paymentResponse?.provedor,
    cobrancaId: paymentResponse?.cobrancaId,
  });
}
