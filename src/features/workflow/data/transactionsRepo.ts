/**
 * Repositório: clientes_transacoes (visão workflow — pagamentos por sessão).
 * Onda 2 — Data layer.
 *
 * Mantém paridade com `useWorkflowRealtime` (batch query `.in('session_id', [...])`
 * filtrada por `tipo in ('pagamento','ajuste')`).
 */

import { supabase } from "@/integrations/supabase/client";
import { chunkedIn, DEFAULT_IN_CHUNK_SIZE } from "./_chunked";

export interface WorkflowTransacao {
  id: string;
  user_id: string;
  cliente_id?: string | null;
  session_id: string;
  tipo: string; // 'pagamento' | 'ajuste' | 'estorno' | ...
  valor: number;
  data_transacao: string | null;
  data_vencimento?: string | null;
  descricao?: string | null;
  forma_pagamento?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const transactionsRepo = {
  /** Batch — retorna transações de várias sessões em uma chamada (chunked). */
  async listBySessionIds(userId: string, sessionIds: string[]): Promise<WorkflowTransacao[]> {
    if (!userId || sessionIds.length === 0) return [];
    const rows = await chunkedIn<WorkflowTransacao>(
      sessionIds,
      DEFAULT_IN_CHUNK_SIZE,
      async (chunk) => {
        const { data, error } = await supabase
          .from("clientes_transacoes")
          .select("*")
          .eq("user_id", userId)
          .in("session_id", chunk)
          .in("tipo", ["pagamento", "ajuste"]);
        if (error) throw error;
        return (data || []) as unknown as WorkflowTransacao[];
      },
    );
    // Reordenar globalmente após concatenar os chunks.
    rows.sort((a, b) => {
      const ad = a.data_transacao ?? "";
      const bd = b.data_transacao ?? "";
      return bd.localeCompare(ad);
    });
    return rows;
  },

  async listBySession(userId: string, sessionId: string): Promise<WorkflowTransacao[]> {
    if (!userId || !sessionId) return [];
    const { data, error } = await supabase
      .from("clientes_transacoes")
      .select("*")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .order("data_transacao", { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as WorkflowTransacao[];
  },

  /** Agrupador puro — não toca o banco. */
  groupBySessionId<T extends { session_id: string }>(rows: T[]): Record<string, T[]> {
    const acc: Record<string, T[]> = {};
    for (const r of rows) {
      const key = r.session_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
    }
    return acc;
  },
};

export type TransactionsRepo = typeof transactionsRepo;
