/**
 * Fonte única para o "painel financeiro" de UMA sessão do Workflow.
 *
 * ⚠️ Regra arquitetural (Opção A — desconto global + sessão vence preço):
 *   O card NUNCA calcula. Toda a matemática (base + extras + produtos +
 *   adicional − desconto, extras pagos/pendentes, créditos) vive na RPC
 *   `workflow_session_financials`. A galeria não é mais consultada aqui —
 *   o próprio RPC já soma os pagamentos vinculados às cobranças com
 *   finalidade `fotos_extras` / `sessao_e_extras`.
 */
import { useMemo } from 'react';
import { useSessionFinancials } from './useSessionFinancials';

export interface SessionFinancialsWithExtras {
  /** Base da sessão (pacote + produtos + adicional − desconto), sem extras. Apenas apresentação. */
  baseSessao: number;
  /** Valor bruto dos extras (com desconto progressivo, ANTES do desconto manual). */
  extrasIdeal: number;
  /** Valor dos extras após aplicar o excedente do desconto manual (fonte de verdade). */
  extrasLiquido: number;
  /** Excedente do desconto manual aplicado sobre os extras. */
  descontoAplicadoExtras: number;
  /**
   * Extras "pagos" para APRESENTAÇÃO — alocação "sessão primeiro, extras depois".
   * NÃO representa mais só cobranças de extras; inclui a sobra de qualquer pagamento
   * após a sessão estar quitada, mais o valor reservado por cobranças de extras.
   */
  extrasPago: number;
  /** Extras ainda em aberto (após alocação sessão-primeiro). */
  extrasPend: number;
  /** Extras pagos EXCLUSIVAMENTE via cobranças com finalidade extras (fonte crua da RPC). */
  extrasPagoCobranca: number;
  /** Total da sessão — VEM DA RPC. */
  totalVisual: number;
  /** Total pago da sessão — VEM DA RPC. */
  pagoTotal: number;
  /** Pendente total — VEM DA RPC. */
  pendenteTot: number;
  /** Pago apenas da sessão (sessão-primeiro, respeitando reserva por cobrança de extras). */
  pagoSessao: number;
  /** Pendente apenas da sessão (sessão-primeiro), para botões de cobrança e modal manual. */
  pendenteSess: number;
  /** True quando há galeria vinculada à sessão. */
  hasGaleria: boolean;
  /** Compatibilidade com callers antigos. */
  resolvedGalleryId: string | null;
  qtdExtras: number;
  qtdExtrasPagas: number;
  creditoLiquido: number;
  isLoading: boolean;
}

export function useSessionFinancialsWithExtras(
  sessionId: string | null | undefined,
  galeriaId?: string | null,
  _sessionSlug?: string | null,
): SessionFinancialsWithExtras {
  const { financials, isLoading } = useSessionFinancials(sessionId);

  return useMemo(() => {
    const totalVisual = financials.valor_total;
    const pagoTotal = financials.valor_pago;
    const pendenteTot = financials.valor_pendente;
    const extrasIdeal = financials.valor_extras_com_desconto;
    const extrasLiquido = financials.extras_liquido ?? extrasIdeal;
    const descontoAplicadoExtras = financials.desconto_aplicado_extras ?? 0;
    const extrasPagoCobranca = financials.extras_pago;
    const baseSessao = Math.max(0, totalVisual - extrasLiquido);

    // Fonte única de verdade: a RPC `workflow_session_financials` já aplica o
    // waterfall "sessão primeiro, extras depois". Não recalculamos nada aqui —
    // qualquer matemática duplicada só mascara futuros bugs.
    const extrasPagoDisplay = Math.min(extrasLiquido, extrasPagoCobranca);
    const extrasPendDisplay = Math.max(0, extrasLiquido - extrasPagoDisplay);
    const pagoSessao = Math.max(0, pagoTotal - extrasPagoDisplay);
    const pendenteSess = Math.max(0, baseSessao - pagoSessao);
    const hasGaleria = Boolean(galeriaId) || financials.qtd_extras_galeria > 0;

    const unit = financials.qtd_fotos_extra > 0
      ? extrasLiquido / financials.qtd_fotos_extra
      : 0;
    const qtdExtrasPagas = unit > 0
      ? Math.min(financials.qtd_fotos_extra, Math.round(extrasPagoDisplay / unit))
      : 0;


    return {
      baseSessao: Number(baseSessao.toFixed(2)),
      extrasIdeal: Number(extrasIdeal.toFixed(2)),
      extrasLiquido: Number(extrasLiquido.toFixed(2)),
      descontoAplicadoExtras: Number(descontoAplicadoExtras.toFixed(2)),
      extrasPago: Number(extrasPagoDisplay.toFixed(2)),
      extrasPend: Number(extrasPendDisplay.toFixed(2)),
      extrasPagoCobranca: Number(extrasPagoCobranca.toFixed(2)),
      totalVisual: Number(totalVisual.toFixed(2)),
      pagoTotal: Number(pagoTotal.toFixed(2)),
      pendenteTot: Number(pendenteTot.toFixed(2)),
      pagoSessao: Number(pagoSessao.toFixed(2)),
      pendenteSess: Number(pendenteSess.toFixed(2)),
      hasGaleria,
      resolvedGalleryId: galeriaId ?? null,
      qtdExtras: financials.qtd_fotos_extra,
      qtdExtrasPagas,
      creditoLiquido: Number((financials.credito_liquido ?? 0).toFixed(2)),
      isLoading,
    };
  }, [financials, galeriaId, isLoading]);
}

