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
  /** Valor canônico dos extras (já com desconto progressivo aplicado). */
  extrasIdeal: number;
  /** Extras já pagos (soma de transações vinculadas às cobranças de extras). */
  extrasPago: number;
  /** Extras ainda em aberto. */
  extrasPend: number;
  /** Total da sessão — VEM DA RPC. */
  totalVisual: number;
  /** Total pago da sessão — VEM DA RPC. */
  pagoTotal: number;
  /** Pendente total — VEM DA RPC. */
  pendenteTot: number;
  /** Pendente apenas da sessão (excluindo extras em aberto), para botões de cobrança. */
  pendenteSess: number;
  /** True quando há galeria vinculada à sessão (via qtd_extras_galeria > 0 ou galeriaId presente). */
  hasGaleria: boolean;
  /** Compatibilidade com callers antigos (ExtraChargeModal). Preservado como null aqui. */
  resolvedGalleryId: string | null;
  /** Contadores de fotos extras. */
  qtdExtras: number;
  qtdExtrasPagas: number;
  /** Crédito líquido (gerado − utilizado). */
  creditoLiquido: number;
  /** Loading. */
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
    const extrasPago = financials.extras_pago;
    const extrasPend = financials.extras_pendente;
    const baseSessao = Math.max(0, totalVisual - extrasIdeal);
    const pendenteSess = Math.max(0, pendenteTot - extrasPend);
    const hasGaleria = Boolean(galeriaId) || financials.qtd_extras_galeria > 0;

    // qtdExtrasPagas: derivado do valor pago vs unitário efetivo (aproximação
    // segura para UI; a fonte de verdade é `extras_pago` em R$).
    const unit = financials.qtd_fotos_extra > 0
      ? extrasIdeal / financials.qtd_fotos_extra
      : 0;
    const qtdExtrasPagas = unit > 0 ? Math.min(financials.qtd_fotos_extra, Math.round(extrasPago / unit)) : 0;

    return {
      baseSessao: Number(baseSessao.toFixed(2)),
      extrasIdeal: Number(extrasIdeal.toFixed(2)),
      extrasPago: Number(extrasPago.toFixed(2)),
      extrasPend: Number(extrasPend.toFixed(2)),
      totalVisual: Number(totalVisual.toFixed(2)),
      pagoTotal: Number(pagoTotal.toFixed(2)),
      pendenteTot: Number(pendenteTot.toFixed(2)),
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
