export async function resolvePaymentStatus(params: {
  supabase: any;
  gallery: any;
  visitorId?: string | null;
}) {
  const { supabase, gallery, visitorId } = params;

  let currentSelectionStatus = gallery.status_selecao;
  let visitorSelectionStatus: string | null = null;

  if (visitorId) {
    const { data: visitor } = await supabase
      .from('galeria_visitantes')
      .select('status_selecao')
      .eq('id', visitorId)
      .maybeSingle();
    visitorSelectionStatus = visitor?.status_selecao || null;
  }

  const isAwaitingPayment = currentSelectionStatus === 'aguardando_pagamento' || visitorSelectionStatus === 'aguardando_pagamento';
  let isFinalized = currentSelectionStatus === 'selecao_completa' || visitorSelectionStatus === 'selecao_completa';

  // 🔒 selectionLocked: verdade única — uma vez travada NUNCA reverte.
  const galleryFinalizedAt = (gallery as any).finalized_at;
  let visitorFinalizedAt: string | null = null;
  if (visitorId) {
    const { data: vRow } = await supabase
      .from('galeria_visitantes')
      .select('finalized_at')
      .eq('id', visitorId)
      .maybeSingle();
    visitorFinalizedAt = (vRow as any)?.finalized_at || null;
  }
  const selectionLocked = Boolean(
    galleryFinalizedAt ||
    visitorFinalizedAt ||
    ['aguardando_pagamento', 'selecao_completa', 'processando_selecao'].includes(currentSelectionStatus) ||
    (visitorSelectionStatus && ['aguardando_pagamento', 'selecao_completa', 'processando_selecao'].includes(visitorSelectionStatus))
  );

  // Auto-heal via RPC canônica: se há cobranças pagas não contabilizadas
  let hasPending = false;
  let hasAnyPaidCharge = false;
  let hasPaid = false;
  let canonicalCalc: any = null;

  if (selectionLocked) {
    const { data: charges } = await supabase
      .from('cobrancas')
      .select('id, status, extras_contabilizados')
      .eq('galeria_id', gallery.id)
      .eq('finalidade', 'fotos_extras');

    hasPending = charges?.some((c: any) => ['pendente', 'aguardando_confirmacao'].includes(c.status)) || false;
    hasAnyPaidCharge = charges?.some((c: any) => ['pago', 'pago_manual'].includes(c.status)) || false;

    if (hasAnyPaidCharge) {
      const needsHeal = (charges || []).filter(
        (c: any) => ['pago', 'pago_manual'].includes(c.status) && c.extras_contabilizados !== true
      );
      for (const c of needsHeal) {
        try {
          await supabase.rpc('finalize_gallery_payment', {
            p_cobranca_id: c.id,
            p_receipt_url: null,
            p_paid_at: new Date().toISOString(),
            p_manual_method: null,
            p_manual_obs: null,
          });
        } catch (healErr) {
          console.error(`[gallery-access] Auto-heal falhou para cobrança ${c.id}:`, healErr);
        }
      }
    }

    try {
      const { data: calc } = await supabase.rpc('calculate_gallery_extra_payment', { p_gallery_id: gallery.id });
      canonicalCalc = calc || null;
    } catch (e) {
      console.error('[gallery-access] calculate_gallery_extra_payment falhou:', e);
    }

    hasPaid = Boolean(
      (canonicalCalc as any)?.is_fully_paid === true &&
      hasAnyPaidCharge
    );

    if (hasPaid && !hasPending) {
      const { data: refreshed } = await supabase
        .from('galerias')
        .select('status_selecao')
        .eq('id', gallery.id)
        .maybeSingle();
      if (refreshed?.status_selecao === 'selecao_completa') {
        currentSelectionStatus = 'selecao_completa';
        isFinalized = true;
      }
      if (visitorId) {
        await supabase
          .from('galeria_visitantes')
          .update({ status_selecao: 'selecao_completa', updated_at: new Date().toISOString() })
          .eq('id', visitorId);
        visitorSelectionStatus = 'selecao_completa';
        isFinalized = true;
      }
    }
  }

  // 🛡️ BLINDAGEM: Se travada e não totalmente paga, NUNCA reportar como finalizada.
  if (selectionLocked && !hasPaid) {
    isFinalized = false;
  }

  let pendingPaymentData: any = null;

  if (selectionLocked && !hasPaid) {
    const { data: cobranca } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('galeria_id', gallery.id)
      .eq('finalidade', 'fotos_extras')
      .in('status', ['pendente', 'aguardando_confirmacao'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const valorCanonico = Number((canonicalCalc as any)?.valor_a_cobrar ?? 0);
    const qtdExtrasCanonico = Number((canonicalCalc as any)?.extras_a_cobrar ?? 0);

    if (cobranca) {
      const checkoutUrl =
        (cobranca as any).ip_checkout_url ||
        (cobranca as any).mp_payment_link ||
        null;

      let asaasCheckoutData: Record<string, unknown> | null = null;
      if ((cobranca.provedor === 'asaas' || cobranca.provedor === 'mercadopago') && ['pendente','aguardando_confirmacao'].includes(cobranca.status)) {
        const { data: integracao } = await supabase
          .from('usuarios_integracoes')
          .select('dados_extras, mp_public_key')
          .eq('user_id', gallery.user_id)
          .eq('provedor', cobranca.provedor)
          .eq('status', 'ativo')
          .maybeSingle();
        const rawExtras = (integracao?.dados_extras || {}) as Record<string, any>;
        const s = {
          ...((rawExtras.gestao_settings as Record<string, any>) || {}),
          ...((rawExtras.gallery_settings as Record<string, any>) || {}),
          ...rawExtras,
        };
        const mpPublicKey = (integracao as any)?.mp_public_key || s.mp_public_key || undefined;
        const valorEfetivo = valorCanonico > 0 ? valorCanonico : Number(cobranca.valor || 0);
        const qtdEfetiva = qtdExtrasCanonico > 0 ? qtdExtrasCanonico : (cobranca.qtd_fotos || 0);
        asaasCheckoutData = {
          galeriaId: gallery.id,
          userId: gallery.user_id,
          valorTotal: valorEfetivo,
          descricao: cobranca.descricao || `Fotos extras - ${gallery.nome_sessao || 'Galeria'}`,
          qtdFotos: qtdEfetiva,
          clienteId: gallery.cliente_id,
          sessionId: gallery.session_id,
          galleryToken: gallery.public_token,
          visitorId: visitorId || undefined,
          cobrancaId: cobranca.id,
          provedor: cobranca.provedor,
          mpPublicKey,
          enabledMethods: {
            pix: s.habilitarPix !== false,
            creditCard: s.habilitarCartao !== false,
            boleto: cobranca.provedor === 'asaas' ? s.habilitarBoleto === true : false,
          },
          maxParcelas: Number(s.maxParcelas) || 12,
          absorverTaxa: s.absorverTaxa ?? false,
          snapshotFotosIncluidas: gallery.fotos_incluidas || 0,
          snapshotRegrasCongeladas: gallery.regras_congeladas,
        };
      }

      let pendingAction: {
        kind: 'external_redirect' | 'asaas_modal' | 'pix_modal' | 'regenerate';
        checkoutUrl?: string | null;
        provedor: string;
      };
      if ((cobranca.provedor === 'asaas' || cobranca.provedor === 'mercadopago') && asaasCheckoutData) {
        pendingAction = { kind: 'asaas_modal', provedor: cobranca.provedor };
      } else if (cobranca.provedor === 'pix_manual') {
        pendingAction = { kind: 'pix_modal', provedor: 'pix_manual' };
      } else if (checkoutUrl) {
        pendingAction = { kind: 'external_redirect', checkoutUrl, provedor: cobranca.provedor };
      } else {
        pendingAction = { kind: 'regenerate', provedor: cobranca.provedor };
      }

      pendingPaymentData = {
        pendingPayment: true,
        paymentMethod: cobranca.provedor,
        checkoutUrl,
        cobrancaId: cobranca.id,
        valorTotal: valorCanonico > 0 ? valorCanonico : Number(cobranca.valor || 0),
        pixDados: (gallery.configuracoes as any)?.pixDados,
        asaasCheckoutData,
        pendingAction,
      };
    } else {
      const provedor = (gallery as any).venda_pagamento_provedor || null;

      let asaasCheckoutData: Record<string, unknown> | null = null;
      let pendingAction: any = { kind: 'regenerate', provedor: provedor || 'desconhecido' };

      if ((provedor === 'asaas' || provedor === 'mercadopago') && valorCanonico > 0) {
        const { data: integracao } = await supabase
          .from('usuarios_integracoes')
          .select('dados_extras, mp_public_key')
          .eq('user_id', gallery.user_id)
          .eq('provedor', provedor)
          .eq('status', 'ativo')
          .maybeSingle();
        const rawExtras = (integracao?.dados_extras || {}) as Record<string, any>;
        const s = {
          ...((rawExtras.gestao_settings as Record<string, any>) || {}),
          ...((rawExtras.gallery_settings as Record<string, any>) || {}),
          ...rawExtras,
        };
        const mpPublicKey = (integracao as any)?.mp_public_key || s.mp_public_key || undefined;
        const descricao = `${qtdExtrasCanonico} foto${qtdExtrasCanonico !== 1 ? 's' : ''} extra${qtdExtrasCanonico !== 1 ? 's' : ''} - ${gallery.nome_sessao || 'Galeria'}`;
        asaasCheckoutData = {
          galeriaId: gallery.id,
          userId: gallery.user_id,
          valorTotal: valorCanonico,
          descricao,
          qtdFotos: qtdExtrasCanonico,
          clienteId: gallery.cliente_id,
          sessionId: gallery.session_id,
          galleryToken: gallery.public_token,
          visitorId: visitorId || undefined,
          provedor: provedor,
          mpPublicKey,
          enabledMethods: {
            pix: s.habilitarPix !== false,
            creditCard: s.habilitarCartao !== false,
            boleto: provedor === 'asaas' ? s.habilitarBoleto === true : false,
          },
          maxParcelas: Number(s.maxParcelas) || 12,
          absorverTaxa: s.absorverTaxa ?? false,
          ireiAntecipar: s.ireiAntecipar ?? s.incluirTaxaAntecipacao ?? false,
          repassarTaxaAntecipacao: s.repassarTaxaAntecipacao ?? s.incluirTaxaAntecipacao ?? false,
          taxaAntecipacao: s.taxaAntecipacao || false,
          taxaAntecipacaoPercentual: s.taxaAntecipacaoPercentual,
          taxaAntecipacaoCreditoAvista: s.taxaAntecipacaoCreditoAvista,
          taxaAntecipacaoCreditoParcelado: s.taxaAntecipacaoCreditoParcelado,
          incluirTaxaAntecipacao: s.incluirTaxaAntecipacao ?? true,
          snapshotFotosIncluidas: gallery.fotos_incluidas || 0,
          snapshotRegrasCongeladas: gallery.regras_congeladas,
        };
        pendingAction = { kind: 'asaas_modal', provedor };
      } else if (provedor === 'pix_manual') {
        pendingAction = { kind: 'pix_modal', provedor: 'pix_manual' };
      }

      pendingPaymentData = {
        pendingPayment: true,
        awaitingCharge: asaasCheckoutData ? false : true,
        paymentMethod: provedor,
        checkoutUrl: null,
        cobrancaId: null,
        valorTotal: valorCanonico,
        pixDados: (gallery.configuracoes as any)?.pixDados,
        asaasCheckoutData,
        needsRegeneration: (gallery as any).payment_needs_regeneration === true,
        pendingAction,
      };
    }
  }

  return {
    isAwaitingPayment,
    isFinalized,
    currentSelectionStatus,
    visitorSelectionStatus,
    selectionLocked,
    galleryFinalizedAt,
    visitorFinalizedAt,
    hasPaid,
    canonicalCalc,
    pendingPaymentData,
  };
}
