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

// A2: Embed reduzido. Listagem só usa `nome` do cliente. Consumidores que
// precisam de email/telefone/whatsapp devem buscar o cliente sob demanda
// (query separada por id, com cache próprio) — evita trafegar contato em
// cada linha de 100+ sessões por mês.
const SELECT_WITH_CLIENTE = `
  *,
  clientes ( nome ),
  galerias ( id, total_fotos_extras_vendidas, valor_total_vendido )
` as const;

/**
 * Projeção enxuta usada pelo listado mensal do Workflow (Tranche 1 de perf).
 * Exclui campos pesados que só o modal expandido precisa: `detalhes`,
 * `observacoes`, `descricao`, `snapshot_extras_at_gallery_delete`,
 * `orcamento_id`, `updated_by`, `created_at`. `regras_congeladas` e
 * `produtos_incluidos` permanecem porque alimentam cálculos locais.
 */
const SELECT_LEAN = `
  id, session_id, user_id, cliente_id,
  data_sessao, hora_sessao, status, status_financeiro,
  status_galeria, status_pagamento_fotos_extra,
  categoria, pacote, descricao,
  valor_total, valor_pago, valor_base_pacote,
  valor_foto_extra, valor_total_foto_extra, qtd_fotos_extra,
  valor_adicional, desconto, credito_aplicado,
  extras_overridden, galeria_id, tipo_registro, appointment_id,
  updated_at, produtos_incluidos, regras_congeladas,
  clientes ( nome ),
  galerias ( id, total_fotos_extras_vendidas, valor_total_vendido )
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
  async listByMonth(
    userId: string,
    year: number,
    month: number,
    opts?: { signal?: AbortSignal; includeHistorico?: boolean },
  ): Promise<WorkflowSession[]> {
    if (!userId) return [];
    const { start, end } = monthBounds(year, month);
    let q = supabase
      .from("clientes_sessoes")
      .select(SELECT_LEAN)
      .eq("user_id", userId)
      .gte("data_sessao", start)
      .lte("data_sessao", end)
      .order("data_sessao", { ascending: true });
    if (!opts?.includeHistorico) {
      q = q.or("status.is.null,status.not.in.(historico,stub)");
    }
    if (opts?.signal) q = q.abortSignal(opts.signal);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as WorkflowSession[];
  },

  /**
   * Lista sessões num intervalo arbitrário (máx 400 dias). Usado por
   * capabilities de análise multi-mês. Paginação keyset por (data_sessao, id).
   */
  async listByRange(
    userId: string,
    startDate: string,
    endDate: string,
    opts?: {
      includeHistorico?: boolean;
      categoria?: string;
      status?: string;
      limit?: number;
      cursor?: { data_sessao: string; id: string } | null;
      signal?: AbortSignal;
    },
  ): Promise<WorkflowSession[]> {
    if (!userId) return [];
    const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 1000);
    let q = supabase
      .from("clientes_sessoes")
      .select(SELECT_LEAN)
      .eq("user_id", userId)
      .gte("data_sessao", startDate)
      .lte("data_sessao", endDate)
      .order("data_sessao", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit);
    if (!opts?.includeHistorico) {
      q = q.or("status.is.null,status.not.in.(historico,stub)");
    }
    if (opts?.categoria) q = q.eq("categoria", opts.categoria);
    if (opts?.status) q = q.eq("status", opts.status);
    if (opts?.cursor) {
      // keyset: (data_sessao > cursor.date) OR (= AND id > cursor.id)
      q = q.or(
        `data_sessao.gt.${opts.cursor.data_sessao},and(data_sessao.eq.${opts.cursor.data_sessao},id.gt.${opts.cursor.id})`,
      );
    }
    if (opts?.signal) q = q.abortSignal(opts.signal);
    const { data, error } = await q;
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
      .or("status.is.null,status.not.in.(historico,stub)")
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
