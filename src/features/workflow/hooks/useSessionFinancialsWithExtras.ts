/**
 * Fonte única para o "painel financeiro" de UMA sessão do Workflow.
 *
 * ⚠️ Regra arquitetural (Opção A — desconto global):
 *   O card NUNCA calcula. Toda a matemática (base + extras + produtos +
 *   adicional − desconto) vive na RPC `workflow_session_financials`,
 *   que também consulta a galeria como fonte dos extras quando existir.
 *
 * Este hook é apenas um adaptador que mapeia os campos da RPC canônica
 * para o formato esperado pelos componentes do Workflow. Ele não faz
 * subtrações, nem `Math.max`, nem mistura de fontes. Se algum valor
 * parecer errado, corrija a RPC — não este arquivo.
 */
import { useMemo } from 'react';
import { useSessionFinancials } from './useSessionFinancials';
import { useGalleryExtraCalc } from '@/hooks/useGalleryExtraCalc';

export interface SessionFinancialsWithExtras {
  /** Base da sessão (pacote + produtos + adicional − desconto), sem extras. Derivado apenas para exibição. */
  baseSessao: number;
  /** Valor canônico dos extras (já com desconto progressivo aplicado). */
  extrasIdeal: number;
  /** Extras já pagos (transações de finalidade fotos_extras). Vem da RPC da galeria (auditoria). */
  extrasPago: number;
  /** Extras ainda em aberto. Vem da RPC da galeria (auditoria de cobrança). */
  extrasPend: number;
  /** Total da sessão — VEM DA RPC, não é calculado aqui. */
  totalVisual: number;
  /** Total pago da sessão — VEM DA RPC. */
  pagoTotal: number;
  /** Pendente total — VEM DA RPC. */
  pendenteTot: number;
  /** Pendente apenas da sessão (excluindo extras em aberto), para os botões de cobrança. */
  pendenteSess: number;
  /** True quando a galeria foi resolvida (por id direto ou via session_id). */
  hasGaleria: boolean;
  /** UUID da galeria resolvida (útil para ExtraChargeModal). */
  resolvedGalleryId: string | null;
  /** Contadores de fotos extras. */
  qtdExtras: number;
  qtdExtrasPagas: number;
  /** Loading composto. */
  isLoading: boolean;
}

export function useSessionFinancialsWithExtras(
  sessionId: string | null | undefined,
  galeriaId?: string | null,
  sessionSlug?: string | null,
): SessionFinancialsWithExtras {
  const { financials, isLoading: loadingFin } = useSessionFinancials(sessionId);
  // Galeria é consultada APENAS para os contadores de "pago / a cobrar" de
  // extras — o valor canônico total já vem da RPC principal.
  const { calc, resolvedGalleryId, isLoading: loadingGal } = useGalleryExtraCalc(
    galeriaId || null,
    { sessionId: sessionSlug || null },
  );

  return useMemo(() => {
    const hasGaleria = Boolean(resolvedGalleryId);

    // Todos os valores canônicos vêm da RPC. Nada de subtração/Math.max aqui.
    const totalVisual = financials.valor_total;
    const pagoTotal = financials.valor_pago;
    const pendenteTot = financials.valor_pendente;
    const extrasIdeal = financials.valor_extras_com_desconto;
    // "baseSessao" é apenas apresentacional (para o breakdown do card).
    const baseSessao = Math.max(0, totalVisual - extrasIdeal);

    // Auditoria de cobrança de extras — quanto já foi cobrado/pago
    // separadamente na galeria e quanto ainda falta cobrar.
    const extrasPago = hasGaleria ? Math.max(0, Number(calc.valor_pago) || 0) : 0;
    const extrasPend = hasGaleria ? Math.max(0, Number(calc.valor_a_cobrar) || 0) : 0;
    const pendenteSess = Math.max(0, pendenteTot - extrasPend);

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
      resolvedGalleryId: resolvedGalleryId ?? null,
      qtdExtras: financials.qtd_fotos_extra,
      qtdExtrasPagas: hasGaleria ? Number(calc.extras_pagas) || 0 : 0,
      isLoading: loadingFin || loadingGal,
    };
  }, [financials, calc, resolvedGalleryId, loadingFin, loadingGal]);
}
