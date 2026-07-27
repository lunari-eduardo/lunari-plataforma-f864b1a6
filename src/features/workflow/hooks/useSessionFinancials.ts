/**
 * Fonte única para os valores financeiros de UMA sessão (Workflow / Modal
 * de Pagamentos / CRM). Consome a RPC `workflow_session_financials`, que
 * é a mesma fonte usada em batch por `useMonthSessionFinancials`.
 *
 * - Realtime: ouve `clientes_sessoes`, `clientes_transacoes` e
 *   `cliente_creditos_ledger` para invalidar a query.
 * - Tipos: SEMPRE `number` (nunca strings BR formatadas).
 * - Sem staleTime: valores financeiros devem refletir o DB o quanto antes.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { acquireChannel, releaseChannel } from '@/shared/realtime/channelRegistry';

/**
 * Chave estável do canal por sessionId. O registry vive em `globalThis`
 * (ver `shared/realtime/channelRegistry`) — sobrevive a code-splitting e
 * garante que Collapsed + Expanded + Modal usem o MESMO canal, sem
 * anexar callbacks depois de `subscribe()`.
 */
function financialsKey(sessionId: string) {
  return `workflow:session-financials:${sessionId}`;
}

function createFinancialsChannel(sessionId: string, invalidate: () => void) {
  return supabase
    .channel(`session-financials-${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'clientes_sessoes', filter: `id=eq.${sessionId}` },
      invalidate,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clientes_transacoes' },
      (payload) => {
        const n = (payload.new as any)?.session_id;
        const o = (payload.old as any)?.session_id;
        if (n === sessionId || o === sessionId) invalidate();
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cliente_creditos_ledger' },
      (payload) => {
        const n1 = (payload.new as any)?.session_id_origem;
        const n2 = (payload.new as any)?.session_id_consumo;
        const o1 = (payload.old as any)?.session_id_origem;
        const o2 = (payload.old as any)?.session_id_consumo;
        if ([n1, n2, o1, o2].includes(sessionId)) invalidate();
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cobrancas' },
      (payload) => {
        const n = (payload.new as any)?.session_id;
        const o = (payload.old as any)?.session_id;
        if (n === sessionId || o === sessionId) invalidate();
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'galerias' },
      () => invalidate(),
    )
    .subscribe();
}

export interface SessionFinancials {
  session_id: string;
  valor_base_pacote: number;
  valor_produtos: number;
  valor_extras_bruto: number;
  valor_extras_com_desconto: number;
  desconto_progressivo: number;
  desconto_manual: number;
  valor_adicional: number;
  valor_total: number;
  valor_pago: number;
  valor_pendente: number;
  qtd_fotos_extra: number;
  qtd_extras_galeria: number;
  credito_gerado: number;
  credito_utilizado: number;
  credito_liquido: number;
  extras_pago: number;
  extras_pendente: number;
  extras_liquido: number;
  desconto_aplicado_extras: number;
}

const ZERO: Omit<SessionFinancials, 'session_id'> = {
  valor_base_pacote: 0,
  valor_produtos: 0,
  valor_extras_bruto: 0,
  valor_extras_com_desconto: 0,
  desconto_progressivo: 0,
  desconto_manual: 0,
  valor_adicional: 0,
  valor_total: 0,
  valor_pago: 0,
  valor_pendente: 0,
  qtd_fotos_extra: 0,
  qtd_extras_galeria: 0,
  credito_gerado: 0,
  credito_utilizado: 0,
  credito_liquido: 0,
  extras_pago: 0,
  extras_pendente: 0,
  extras_liquido: 0,
  desconto_aplicado_extras: 0,
};


function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function normalize(row: Record<string, unknown> | null | undefined, sessionId: string): SessionFinancials {
  if (!row) return { session_id: sessionId, ...ZERO };
  return {
    session_id: (row.session_id as string) ?? sessionId,
    valor_base_pacote: toNum(row.valor_base_pacote),
    valor_produtos: toNum(row.valor_produtos),
    valor_extras_bruto: toNum(row.valor_extras_bruto),
    valor_extras_com_desconto: toNum(row.valor_extras_com_desconto),
    desconto_progressivo: toNum(row.desconto_progressivo),
    desconto_manual: toNum(row.desconto_manual),
    valor_adicional: toNum(row.valor_adicional),
    valor_total: toNum(row.valor_total),
    valor_pago: toNum(row.valor_pago),
    valor_pendente: toNum(row.valor_pendente),
    qtd_fotos_extra: Math.round(toNum(row.qtd_fotos_extra)),
    qtd_extras_galeria: Math.round(toNum(row.qtd_extras_galeria)),
    credito_gerado: toNum(row.credito_gerado),
    credito_utilizado: toNum(row.credito_utilizado),
    credito_liquido: toNum(row.credito_liquido),
    extras_pago: toNum(row.extras_pago),
    extras_pendente: toNum(row.extras_pendente),
    extras_liquido: toNum(row.extras_liquido),
    desconto_aplicado_extras: toNum(row.desconto_aplicado_extras),
  };
}


export function useSessionFinancials(sessionId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['session-financials', sessionId],
    enabled: !!sessionId,
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('workflow_session_financials', {
        p_session_id: sessionId as string,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return normalize(row as Record<string, unknown> | null, sessionId as string);
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ['session-financials', sessionId] });

    // Canal Realtime compartilhado por sessionId via registry global
    // (sobrevive a code-splitting). Callbacks são anexados apenas na criação.
    const key = financialsKey(sessionId);
    acquireChannel(key, () => createFinancialsChannel(sessionId, invalidate));

    const bridgeHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const affected = detail.sessionId ?? detail.session?.id;
      if (affected === sessionId) invalidate();
    };
    const paymentBridge = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const candidates = [
        detail.sessionUuid,
        detail.sessionId,
        detail.session?.id,
        detail.session?.sessionId,
      ].filter(Boolean);
      if (candidates.includes(sessionId)) invalidate();
    };
    const financialsStaleBridge = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.sessionId === sessionId) invalidate();
    };
    window.addEventListener('workflow-session-updated', bridgeHandler as EventListener);
    window.addEventListener('workflow-session-financials-stale', financialsStaleBridge as EventListener);
    window.addEventListener('payment-optimistic', paymentBridge as EventListener);
    window.addEventListener('payment-created', paymentBridge as EventListener);

    return () => {
      releaseFinancialsChannel(sessionId);
      window.removeEventListener('workflow-session-updated', bridgeHandler as EventListener);
      window.removeEventListener('workflow-session-financials-stale', financialsStaleBridge as EventListener);
      window.removeEventListener('payment-optimistic', paymentBridge as EventListener);
      window.removeEventListener('payment-created', paymentBridge as EventListener);
    };
  }, [sessionId, queryClient]);

  return {
    financials: query.data ?? { session_id: sessionId ?? '', ...ZERO },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
