/**
 * Repositório: clientes_sessoes
 * Único caminho Supabase para leitura/escrita da tabela no escopo workflow.
 * Onda 2 — Data layer. Mantém paridade com `Context.fetchAndCacheMonth`
 * e `useWorkflowRealtime.loadSessions` (filtros e JOIN clientes).
 *
 * Restrições:
 * - Não faz cache (cache vive em `store/`).
 * - Não emite eventos (eventos vivem em `actions/`).
 * - Sempre retorna `WorkflowSession[]` ou `WorkflowSession | null`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { WorkflowSession } from "../domain/session";

const SELECT_WITH_CLIENTE = `
  *,
  clientes (
    nome,
    email,
    telefone,
    whatsapp
  )
` as const;

/** Formato YYYY-MM-DD sem timezone, idêntico ao usado pelo Context. */
function dateOnly(d: Date): string {
  return d.toISOString().split("T")[0];
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  // Mesmo cálculo do Context: dia 0 do mês seguinte = último dia do mês atual.
  return {
    start: dateOnly(new Date(year, month - 1, 1)),
    end: dateOnly(new Date(year, month, 0)),
  };
}

export const sessionsRepo = {
  /** Lista sessões de um mês para o usuário, com JOIN clientes. */
  async listByMonth(userId: string, year: number, month: number): Promise<WorkflowSession[]> {
    if (!userId) return [];
    const { start, end } = monthBounds(year, month);
    const { data, error } = await supabase
      .from("clientes_sessoes")
      .select(SELECT_WITH_CLIENTE)
      .eq("user_id", userId)
      .gte("data_sessao", start)
      .lte("data_sessao", end)
      .neq("status", "historico")
      .order("data_sessao", { ascending: true });
    if (error) throw error;
    return (data || []) as unknown as WorkflowSession[];
  },

  /** Carga inicial: últimos N meses (default 12), ordenado por data/hora. */
  async listLastMonths(userId: string, months = 12): Promise<WorkflowSession[]> {
    if (!userId) return [];
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const dateFilter = dateOnly(cutoff);
    const { data, error } = await supabase
      .from("clientes_sessoes")
      .select(SELECT_WITH_CLIENTE)
      .eq("user_id", userId)
      .neq("status", "historico")
      .gte("data_sessao", dateFilter)
      .order("data_sessao", { ascending: true })
      .order("hora_sessao", { ascending: true });
    if (error) throw error;
    return (data || []) as unknown as WorkflowSession[];
  },

  /** Lookup por uuid primary key. */
  async getById(userId: string, id: string): Promise<WorkflowSession | null> {
    if (!userId || !id) return null;
    const { data, error } = await supabase
      .from("clientes_sessoes")
      .select(SELECT_WITH_CLIENTE)
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as WorkflowSession) ?? null;
  },

  /** Lookup pelo session_id texto (legado workflow-*). */
  async getBySessionId(userId: string, sessionId: string): Promise<WorkflowSession | null> {
    if (!userId || !sessionId) return null;
    const { data, error } = await supabase
      .from("clientes_sessoes")
      .select(SELECT_WITH_CLIENTE)
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as WorkflowSession) ?? null;
  },

  /**
   * Update parcial. NUNCA aceita `clientes`, `pagamentos`, `created_at` ou
   * `status_financeiro` (computado). Sanitização adicional de pricing fica
   * a cargo das actions; aqui só removemos chaves read-only conhecidas.
   */
  async update(userId: string, id: string, updates: Partial<WorkflowSession>): Promise<void> {
    if (!userId || !id) throw new Error("sessionsRepo.update: userId e id obrigatórios");
    const safe: Record<string, unknown> = { ...updates };
    delete safe.clientes;
    delete safe.pagamentos;
    delete safe.created_at;
    delete safe.status_financeiro;
    delete safe.galerias;
    const { error } = await supabase
      .from("clientes_sessoes")
      .update({ ...safe, updated_by: userId })
      .eq("user_id", userId)
      .eq("id", id);
    if (error) throw error;
  },

  /** Remoção dura — preferir `rpc.deleteWorkflowSessionCascade` na maior parte dos casos. */
  async hardDelete(userId: string, id: string): Promise<void> {
    if (!userId || !id) throw new Error("sessionsRepo.hardDelete: userId e id obrigatórios");
    const { error } = await supabase
      .from("clientes_sessoes")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);
    if (error) throw error;
  },
};

export type SessionsRepo = typeof sessionsRepo;
