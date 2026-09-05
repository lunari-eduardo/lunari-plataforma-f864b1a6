import { resolvePayerHints } from '../_shared/payer-hints.ts';

export async function resolvePayerHintsAndMissing(params: {
  supabase: any;
  gallery: any;
  visitorId?: string | null;
}) {
  const { supabase, gallery, visitorId } = params;

  let payerHintsMissing: {
    email: boolean;
    phone: boolean;
    name: boolean;
    cpfCnpj: boolean;
    provider: 'asaas' | 'infinitepay' | 'mercadopago' | null;
    billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | null;
    cpfRequired: boolean;
  } | null = null;

  let payerHintsValues: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    cpfCnpj: string | null;
  } | null = null;

  try {
    const hints = await resolvePayerHints({
      supabase,
      clienteId: (gallery as any).cliente_id || null,
      galleryId: gallery.id,
      sessionId: (gallery as any).session_id || null,
      visitorId: visitorId || null,
    });

    let provider: 'asaas' | 'infinitepay' | 'mercadopago' | null = (gallery as any).venda_pagamento_provedor || null;
    let billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | null = null;

    if (!provider) {
      const { data: integracoes } = await supabase
        .from('usuarios_integracoes')
        .select('provedor, dados_extras, is_default')
        .eq('user_id', gallery.user_id)
        .eq('status', 'ativo')
        .in('provedor', ['asaas', 'infinitepay', 'mercadopago']);
      if (integracoes && integracoes.length > 0) {
        const chosen = integracoes.find((i: any) => i.is_default) || integracoes[0];
        provider = chosen.provedor as any;
        if (provider === 'asaas') {
          const raw = (chosen.dados_extras || {}) as Record<string, any>;
          const s = { ...raw, ...(raw.gallery_settings || {}) };
          billingType = s.habilitarPix ? 'PIX' : s.habilitarCartao ? 'CREDIT_CARD' : s.habilitarBoleto ? 'BOLETO' : 'PIX';
        }
      }
    }

    const cpfRequired = provider === 'asaas' || provider === 'infinitepay';
    payerHintsMissing = {
      email: !hints.email,
      phone: !hints.phone,
      name: !hints.firstName && !hints.name,
      cpfCnpj: cpfRequired && !hints.cpfCnpj,
      provider,
      billingType,
      cpfRequired,
    };
    payerHintsValues = {
      fullName: hints.name || null,
      email: hints.email || null,
      phone: hints.phone || null,
      cpfCnpj: hints.cpfCnpj || null,
    };
  } catch (e) {
    console.warn('[gallery-access] payer hints resolve falhou:', e instanceof Error ? e.message : String(e));
  }

  return { payerHintsMissing, payerHintsValues };
}
