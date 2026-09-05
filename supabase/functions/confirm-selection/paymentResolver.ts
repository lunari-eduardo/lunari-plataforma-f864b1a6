import { logAuditEvent } from '../_shared/audit.ts';
import { corsHeaders, errorResponse } from '../_shared/responses.ts';

const EXPECTED_GCP_VERSION = 'v2.2.1';

export async function resolvePayment(params: {
  supabase: any;
  gallery: any;
  galleryId: string;
  galleryToken: string;
  saleSettingsJson: any;
  valorTotal: number;
  extrasACobrar: number;
  extrasCount: number;
  correlationId: string;
  visitorId?: string;
  payer?: any;
  supabaseUrl: string;
  supabaseServiceKey: string;
  rollbackGalleryStatus: () => Promise<void>;
}) {
  const {
    supabase,
    gallery,
    galleryId,
    galleryToken,
    saleSettingsJson,
    valorTotal,
    extrasACobrar,
    extrasCount,
    correlationId,
    visitorId,
    payer,
    supabaseUrl,
    supabaseServiceKey,
    rollbackGalleryStatus,
  } = params;

  const saleSettingsMode = saleSettingsJson.mode;
  const vendaModoColumn = gallery.venda_modo;

  const VALID_SALE_MODES = ['no_sale', 'sale_with_payment', 'sale_without_payment'];
  const isValidVendaModoColumn = vendaModoColumn && VALID_SALE_MODES.includes(vendaModoColumn);
  const isValidVendaModoJson = saleSettingsMode && VALID_SALE_MODES.includes(saleSettingsMode);

  const saleMode = isValidVendaModoColumn
    ? vendaModoColumn
    : (isValidVendaModoJson ? saleSettingsMode : 'no_sale');

  if (isValidVendaModoColumn && isValidVendaModoJson && saleSettingsMode !== vendaModoColumn) {
    console.warn(`⚠️ SALE_MODE_DIVERGENCE gallery=${galleryId} column=${vendaModoColumn} json=${saleSettingsMode} — column wins`);
    await logAuditEvent({
      correlationId,
      eventType: 'SALE_MODE_DIVERGENCE',
      source: 'edge_function',
      sourceName: 'confirm-selection',
      payload: { galleryId, column: vendaModoColumn, json: saleSettingsMode }
    });
  }

  const configuredPaymentMethod = gallery.venda_pagamento_provedor || saleSettingsJson.paymentMethod;
  const shouldCreatePayment = saleMode === 'sale_with_payment' && valorTotal > 0 && extrasACobrar > 0;

  console.log(`💰 Payment check: mode=${saleMode}, provider=${configuredPaymentMethod}, valorTotal=${valorTotal}, extrasACobrar=${extrasACobrar}, shouldCreate=${shouldCreatePayment}`);

  let paymentResponse: { checkoutUrl?: string; provedor?: string; cobrancaId?: string; [key: string]: any } | null = null;
  let statusPagamento = 'sem_vendas';

  if (shouldCreatePayment) {
    let integracao: any;

    if (configuredPaymentMethod) {
      const { data } = await supabase
        .from('usuarios_integracoes')
        .select('provedor, dados_extras, mp_public_key, access_token')
        .eq('user_id', gallery.user_id)
        .eq('provedor', configuredPaymentMethod)
        .eq('status', 'ativo')
        .maybeSingle();
      integracao = data;
    } else {
      const { data } = await supabase
        .from('usuarios_integracoes')
        .select('provedor, dados_extras, mp_public_key, access_token')
        .eq('user_id', gallery.user_id)
        .eq('is_default', true)
        .eq('status', 'ativo')
        .in('provedor', ['mercadopago', 'infinitepay', 'pix_manual', 'asaas'])
        .maybeSingle();
      integracao = data;

      if (!integracao) {
        const { data: anyActive } = await supabase
          .from('usuarios_integracoes')
          .select('provedor, dados_extras, mp_public_key, access_token')
          .eq('user_id', gallery.user_id)
          .eq('status', 'ativo')
          .in('provedor', ['mercadopago', 'infinitepay', 'pix_manual', 'asaas'])
          .limit(1)
          .maybeSingle();
        integracao = anyActive;
      }
    }

    if (integracao?.provedor === 'pix_manual') {
      statusPagamento = 'aguardando_confirmacao';
      paymentResponse = { provedor: 'pix_manual' };
      console.log(`📱 PIX Manual configured for gallery ${galleryId}`);
    } else if (integracao && (integracao.provedor === 'infinitepay' || integracao.provedor === 'mercadopago' || integracao.provedor === 'asaas')) {
      if (integracao.provedor === 'asaas' || integracao.provedor === 'mercadopago') {
        const rawExtras = (integracao.dados_extras || {}) as Record<string, any>;
        const unifiedSettings = {
          ...((rawExtras.gestao_settings as Record<string, any>) || {}),
          ...((rawExtras.gallery_settings as Record<string, any>) || {}),
          ...rawExtras,
        };
        const mpPublicKey = (integracao as any).mp_public_key || unifiedSettings.mp_public_key || undefined;

        let sessionIdTexto = gallery.session_id;
        if (sessionIdTexto && !sessionIdTexto.startsWith('workflow-') && !sessionIdTexto.startsWith('session_')) {
          const { data: sessao } = await supabase
            .from('clientes_sessoes')
            .select('session_id')
            .or(`id.eq.${sessionIdTexto},session_id.eq.${sessionIdTexto}`)
            .maybeSingle();
          sessionIdTexto = sessao?.session_id || sessionIdTexto;
        }

        const descricao = `${extrasACobrar} foto${extrasACobrar !== 1 ? 's' : ''} extra${extrasACobrar !== 1 ? 's' : ''} - ${gallery.nome_sessao || 'Galeria'}`;
        statusPagamento = 'pendente';
        paymentResponse = { provedor: integracao.provedor };

        const asaasCheckoutData = {
          galeriaId: galleryId,
          userId: gallery.user_id,
          valorTotal,
          descricao,
          qtdFotos: extrasACobrar,
          clienteId: gallery.cliente_id,
          sessionId: sessionIdTexto,
          galleryToken: gallery.public_token,
          visitorId: visitorId || undefined,
          provedor: integracao.provedor,
          mpPublicKey,
          enabledMethods: {
            pix: unifiedSettings.habilitarPix !== false,
            creditCard: unifiedSettings.habilitarCartao !== false,
            boleto: integracao.provedor === 'asaas' ? unifiedSettings.habilitarBoleto === true : false,
          },
          maxParcelas: Number(unifiedSettings.maxParcelas) || 12,
          absorverTaxa: unifiedSettings.absorverTaxa ?? false,
          ireiAntecipar: unifiedSettings.ireiAntecipar ?? unifiedSettings.incluirTaxaAntecipacao ?? false,
          repassarTaxaAntecipacao: unifiedSettings.repassarTaxaAntecipacao ?? unifiedSettings.incluirTaxaAntecipacao ?? false,
          taxaAntecipacao: unifiedSettings.taxaAntecipacao || false,
          taxaAntecipacaoPercentual: unifiedSettings.taxaAntecipacaoPercentual,
          taxaAntecipacaoCreditoAvista: unifiedSettings.taxaAntecipacaoCreditoAvista,
          taxaAntecipacaoCreditoParcelado: unifiedSettings.taxaAntecipacaoCreditoParcelado,
          incluirTaxaAntecipacao: unifiedSettings.incluirTaxaAntecipacao ?? true,
          snapshotFotosIncluidas: gallery.fotos_incluidas || 0,
          snapshotRegrasCongeladas: gallery.regras_congeladas,
          correlationId,
        };

        console.log(`💳 ${integracao.provedor} transparent checkout prepared for gallery ${galleryId}, R$ ${valorTotal}`);
        paymentResponse.__asaasCheckoutData = asaasCheckoutData;
      } else {
        try {
          const gcpUrl = `${supabaseUrl}/functions/v1/gallery-create-payment`;
          console.log(`[confirm-selection] Delegating to gallery-create-payment (provider=${integracao.provedor}) with preloaded…`);

          let sessionIdTextoPre: string | null = null;
          if (gallery.session_id) {
            if (gallery.session_id.startsWith('workflow-') || gallery.session_id.startsWith('session_')) {
              sessionIdTextoPre = gallery.session_id;
            }
          }

          const strictValorTotal = typeof valorTotal === 'number' && !Number.isNaN(valorTotal) ? valorTotal : Number(valorTotal) || 0;
          const strictExtras = typeof extrasACobrar === 'number' && !Number.isNaN(extrasACobrar) ? extrasACobrar : Number(extrasACobrar) || 0;

          if (strictValorTotal <= 0) {
            console.error(`🚨 [confirm-selection] GCP bypass: Tentando criar pagamento com valor nulo/zero.`, { valorTotal, strictValorTotal });
          }

          const gcpBody: Record<string, unknown> = {
            galleryId,
            clienteId: gallery.cliente_id || null,
            sessionId: sessionIdTextoPre || gallery.session_id || null,
            valor: strictValorTotal,
            valorTotal: strictValorTotal,
            qtdFotosExtras: strictExtras,
            extraCount: strictExtras,
            provedor: integracao.provedor,
            provider: integracao.provedor,
            context: 'confirm_selection',
            expectedVersion: EXPECTED_GCP_VERSION,
            bypassPreSelecaoGate: true,
            visitorId: visitorId || undefined,
            snapshotFotosIncluidas: gallery.fotos_incluidas || 0,
            snapshotRegrasCongeladas: gallery.regras_congeladas,
            correlationId,
            payer,
            preloaded: {
              gallery: {
                id: galleryId,
                user_id: gallery.user_id,
                cliente_id: gallery.cliente_id || null,
                session_id: gallery.session_id,
                nome_sessao: gallery.nome_sessao,
                public_token: galleryToken,
                fotos_incluidas: gallery.fotos_incluidas,
                regras_congeladas: gallery.regras_congeladas,
              },
              valorCanonico: strictValorTotal,
              extrasACobrar: strictExtras,
              isFullyPaid: false,
              provedor: integracao.provedor,
              sessionIdTexto: sessionIdTextoPre,
            },
          };

          const postGcp = (extra?: Record<string, unknown>) => fetch(gcpUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify(extra ? { ...gcpBody, ...extra } : gcpBody),
          });

          const readGcp = async (res: Response): Promise<Record<string, unknown> | null> => {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) return await res.json();
            const textBody = await res.text();
            console.error(`❌ gallery-create-payment returned non-JSON (${ct}):`, textBody.substring(0, 300));
            return null;
          };

          let gcpResponse = await postGcp();
          let paymentData = await readGcp(gcpResponse);

          const gotVersion = (paymentData?.version as string) || gcpResponse.headers.get('x-gcp-version') || 'unknown';
          if (gotVersion !== EXPECTED_GCP_VERSION) {
            console.warn(`⚠️ PIPELINE_VERSION_DRIFT expected=${EXPECTED_GCP_VERSION} got=${gotVersion}`);
          }

          const legacyNeedsCliente =
            gcpResponse.status === 400 &&
            /clienteid/i.test(String(paymentData?.error ?? ''));

          if (legacyNeedsCliente) {
            console.warn('⚠️ GCP_LEGACY_FALLBACK — build antiga detectada, repetindo com payload legado');
            gcpResponse = await postGcp({
              clienteId: gallery.cliente_id || null,
              sessionId: sessionIdTextoPre || gallery.session_id || null,
              valorTotal,
              extraCount: extrasACobrar,
              descricao: `Fotos extras — ${gallery.nome_sessao || 'Galeria'}`,
            });
            paymentData = await readGcp(gcpResponse);
          }

          if (gcpResponse.ok && paymentData?.success) {
            const checkoutUrl = paymentData.checkoutUrl as string | undefined;
            const cobrancaId = paymentData.cobrancaId as string | undefined;
            const provedorFinal = (paymentData.provedor as string) || integracao.provedor;

            paymentResponse = {
              checkoutUrl,
              provedor: provedorFinal,
              cobrancaId,
            };
            statusPagamento = 'pendente';
            console.log(`💳 Payment created via gcp: ${cobrancaId} @ ${provedorFinal}`);
          } else {
            const errorMsg = (paymentData?.error as string) || 'Falha na criação do link de pagamento';
            let errorCode = (paymentData?.code as string) || 'PAYMENT_CREATE_ERROR';
            const errorDetails = (paymentData?.details as string) || '';

            const isOverchargeReject =
              errorCode === 'CHARGE_DB_ERROR' &&
              /excederia o saldo|maior que o valor/i.test(errorDetails);
            const outMsg = isOverchargeReject
              ? 'O valor calculado ficou acima do saldo devido. Atualize a página e tente novamente — se persistir, contate o fotógrafo.'
              : errorMsg;
            if (isOverchargeReject) errorCode = 'CHARGE_OVERCHARGE';

            console.error(`❌ CRITICAL: gcp failed: [${errorCode}] ${errorMsg} ${errorDetails}`);

            await rollbackGalleryStatus();
            return {
              error: new Response(
                JSON.stringify({ error: outMsg, code: errorCode, details: errorDetails }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            };
          }
        } catch (payErr) {
          console.error('❌ CRITICAL: gcp fetch error:', payErr);
          await rollbackGalleryStatus();
          return {
            error: new Response(
              JSON.stringify({
                error: 'Erro ao processar cobrança. Tente novamente.',
                code: 'PAYMENT_ERROR',
                details: payErr instanceof Error ? payErr.message : 'Erro desconhecido'
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          };
        }
      }
    } else {
      console.error('❌ CRITICAL: No payment provider configured for user but payment required');
      await rollbackGalleryStatus();
      return {
        error: new Response(
          JSON.stringify({
            error: 'Nenhum método de pagamento configurado. Configure nas configurações.',
            code: 'NO_PAYMENT_PROVIDER'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      };
    }
  }

  // Safety check
  if (shouldCreatePayment && (!paymentResponse || (!paymentResponse.checkoutUrl && !paymentResponse.provedor))) {
    console.error('❌ CRITICAL: Payment was required but no response/link generated. Blocking gallery finalization.');
    await rollbackGalleryStatus();
    return {
      error: new Response(
        JSON.stringify({
          error: 'Erro ao gerar link de pagamento. Por favor, tente novamente.',
          code: 'PAYMENT_GENERATION_FAILED'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return {
    saleMode,
    shouldCreatePayment,
    paymentResponse,
    statusPagamento,
  };
}
