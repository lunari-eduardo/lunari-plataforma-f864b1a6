/**
 * Fonte única para o "painel financeiro" de UMA sessão do Workflow.
 *
 * Combina duas RPCs canônicas — porque o valor "canônico" das fotos extras
 * vive na galeria (RPC `calculate_gallery_extra_payment`, que aplica
 * desconto progressivo e faixas congeladas em tempo real), enquanto o
 * restante (base do pacote, produtos, adicional, desconto manual,
 * pagamentos e ledger de créditos) vive em `workflow_session_financials`.
 *
 * Espelha a lógica de recomposição já usada nos cards do Workflow
 * (`WorkflowCardCollapsed` e `WorkflowCardExpanded`):
 *
 *   baseSessao   = valor_total − valor_extras_com_desconto
 *   extrasIdeal  = hasGaleria ? extraCalc.valor_total_ideal : valor_extras_com_desconto
 *   totalVisual  = baseSessao + extrasIdeal
 *   pendenteTot  = max(0, totalVisual − valor_pago)
 *   pendenteSess = max(0, pendenteTot − extrasPend)
 *
 * Todos os campos retornados são `number` — nunca strings BR — e o hook
 * herda os realtimes dos dois hooks internos (clientes_sessoes,
 * clientes_transacoes, cliente_creditos_ledger, galerias, cobrancas).
 */
import { useMemo } from 'react';
import { useSessionFinancials } from './useSessionFinancials';
import { useGalleryExtraCalc } from '@/hooks/useGalleryExtraCalc';

export interface SessionFinancialsWithExtras {
  /** Base da sessão (pacote + produtos + adicional − desconto), sem extras. */
  baseSessao: number;
  /** Valor canônico dos extras (com desconto progressivo, se aplicável). */
  extrasIdeal: number;
  /** Extras já pagos (transações vinculadas à galeria com finalidade fotos_extras). */
  extrasPago: number;
  /** Extras ainda em aberto (`valor_a_cobrar` da RPC). */
  extrasPend: number;
  /** Total visual — o que o cliente deve pela sessão + extras. */
  totalVisual: number;
  /** Total pago (transações — inclui pagamentos de sessão e de extras). */
  pagoTotal: number;
  /** Pendente total (sessão + extras). */
  pendenteTot: number;
  /** Pendente apenas da sessão (excluindo extras em aberto). */
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
  const { calc, resolvedGalleryId, isLoading: loadingGal } = useGalleryExtraCalc(
    galeriaId || null,
    { sessionId: sessionSlug || null },
  );

  return useMemo(() => {
    const hasGaleria = Boolean(resolvedGalleryId);

    // baseSessao = valor_total gravado no DB menos a parcela de extras
    // atualmente computada pelo trigger. Assim, quando substituímos
    // `valor_extras_com_desconto` pela versão canônica (galeria), o
    // resultado permanece consistente mesmo se o trigger estiver atrasado.
    const baseSessao = Math.max(
      0,
      financials.valor_total - financials.valor_extras_com_desconto,
    );

    const extrasIdeal = hasGaleria
      ? calc.valor_total_ideal
      : financials.valor_extras_com_desconto;
    const extrasPago = hasGaleria ? calc.valor_pago : 0;
    const extrasPend = hasGaleria ? Math.max(0, calc.valor_a_cobrar) : 0;

    const totalVisual = baseSessao + extrasIdeal;
    const pagoTotal = financials.valor_pago;
    const pendenteTot = Math.max(0, totalVisual - pagoTotal);
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
      qtdExtras: hasGaleria ? calc.extras_necessarias : financials.qtd_fotos_extra,
      qtdExtrasPagas: hasGaleria ? calc.extras_pagas : 0,
      isLoading: loadingFin || loadingGal,
    };
  }, [financials, calc, resolvedGalleryId, loadingFin, loadingGal]);
}
