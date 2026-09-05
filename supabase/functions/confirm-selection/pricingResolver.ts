import { RegrasCongeladas } from '../_shared/types.ts';
import { calcularPrecoProgressivoComCredito } from '../_shared/pricing.ts';

export async function resolvePricing(params: {
  supabase: any;
  galleryId: string;
  gallery: any;
  selectedCount: number;
  initialExtrasPagas: number;
  initialValorPago: number;
}) {
  const { supabase, galleryId, gallery, selectedCount } = params;
  let extrasPagasTotal = params.initialExtrasPagas;
  let valorJaPago = params.initialValorPago;

  const saleSettingsJson = (gallery.configuracoes as any)?.saleSettings || {};
  const chargeType = gallery.venda_tipo_cobranca || saleSettingsJson.chargeType || 'only_extras';

  const extrasNecessarias = chargeType === 'all_selected'
    ? (selectedCount || 0)
    : Math.max(0, (selectedCount || 0) - (gallery.fotos_incluidas || 0));

  let valorUnitario = 0;
  let valorTotal = 0;
  let extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);
  let canonRulesSource: string | null = null;

  try {
    const { data: canon, error: canonErr } = await supabase.rpc('calculate_gallery_extra_payment', {
      p_gallery_id: galleryId,
      p_bypass_pre_selecao_gate: true,
    });

    if (canonErr) throw canonErr;
    if (!canon || (canon as any).success !== true) {
      throw new Error(`RPC retornou success=false: ${JSON.stringify(canon)}`);
    }

    const c = canon as Record<string, any>;
    canonRulesSource = c.rules_source ?? null;
    valorUnitario = Number(c.valor_unitario) || 0;
    valorTotal = Number(c.valor_a_cobrar) || 0;
    extrasACobrar = Number(c.extras_a_cobrar) || 0;
    extrasPagasTotal = Number(c.extras_pagas) || extrasPagasTotal;
    valorJaPago = Number(c.valor_pago) || valorJaPago;

    console.log(`📊 [RPC canônica] rules_source=${c.rules_source}, extras_necess=${c.extras_necessarias}, extras_pagas=${c.extras_pagas}, extras_a_cobrar=${c.extras_a_cobrar}, valor_unitario=R$${c.valor_unitario}, valor_total_ideal=R$${c.valor_total_ideal}, valor_pago=R$${c.valor_pago}, valor_a_cobrar=R$${c.valor_a_cobrar}`);
  } catch (rpcErr) {
    console.error('❌ [FALLBACK] calculate_gallery_extra_payment falhou, usando cálculo local:', rpcErr);

    let regrasCongeladasSource: RegrasCongeladas | null = null;
    let fallbackPrice = Number(gallery.valor_foto_extra || 0);

    if (fallbackPrice <= 0) {
      if (gallery.session_id) {
        const { data: sessao } = await supabase
          .from('clientes_sessoes')
          .select('regras_congeladas')
          .eq('session_id', gallery.session_id)
          .single();
        if (sessao?.regras_congeladas) {
          regrasCongeladasSource = sessao.regras_congeladas as RegrasCongeladas;
        }
      }
      if (!regrasCongeladasSource && gallery.regras_congeladas) {
        regrasCongeladasSource = gallery.regras_congeladas as RegrasCongeladas;
      }
      if (regrasCongeladasSource) {
        fallbackPrice = Number((regrasCongeladasSource as any)?.pacote?.valorFotoExtra ?? 0);
      }
    }

    const resultado = calcularPrecoProgressivoComCredito(
      extrasACobrar,
      extrasPagasTotal,
      valorJaPago,
      regrasCongeladasSource,
      fallbackPrice
    );
    valorUnitario = resultado.valorUnitario;
    valorTotal = resultado.valorACobrar;
  }

  return {
    chargeType,
    extrasNecessarias,
    valorUnitario,
    valorTotal,
    extrasACobrar,
    extrasPagasTotal,
    valorJaPago,
    canonRulesSource,
    saleSettingsJson,
  };
}
