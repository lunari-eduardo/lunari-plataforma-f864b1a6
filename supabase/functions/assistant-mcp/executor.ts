/**
 * assistant-mcp/executor.ts — Onda F.2
 *
 * Bridge de execução server-side para tools MCP read-only.
 * Cada handler recebe um Supabase service-role client + o user_id resolvido
 * do PAT e devolve o resultado no shape MCP.
 *
 * Escopo v1: apenas leituras curadas (agenda, clientes, sessões, tarefas,
 * galerias, resumo financeiro). Tools de escrita continuam retornando
 * "execute no app" — a bridge de mutação exige OAuth + approval e vem em F.3.
 */
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface McpContent {
  type: "text";
  text: string;
}
export interface McpToolResult {
  content: McpContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

type Handler = (
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, any>,
) => Promise<McpToolResult>;

const ok = (structured: unknown, summary: string): McpToolResult => ({
  content: [{ type: "text", text: summary }],
  structuredContent:
    structured && typeof structured === "object"
      ? (structured as Record<string, unknown>)
      : { value: structured },
});

const fail = (message: string): McpToolResult => ({
  isError: true,
  content: [{ type: "text", text: message }],
});

function clampLimit(n: unknown, def = 20, max = 100): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return def;
  return Math.min(Math.floor(v), max);
}

/**
 * Whitelist de tools MCP executáveis server-side na Onda F.2.
 * Chave = nome MCP totalmente qualificado (mesmo do catalog.json).
 */
export const READ_ONLY_BRIDGE: Record<string, Handler> = {
  "lunari.agenda.appointments.list": async (sb, uid, args) => {
    const limit = clampLimit(args.limit);
    let q = sb
      .from("appointments")
      .select("id,title,date,time,status,type,cliente_id,duration_minutes")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(limit);
    if (args.from) q = q.gte("date", String(args.from));
    if (args.to) q = q.lte("date", String(args.to));
    if (args.status) q = q.eq("status", String(args.status));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ appointments: data ?? [] }, `Retornei ${data?.length ?? 0} agendamento(s).`);
  },

  "lunari.clientes.list": async (sb, uid, args) => {
    const limit = clampLimit(args.limit);
    let q = sb
      .from("clientes")
      .select("id,nome,email,telefone,created_at")
      .eq("user_id", uid)
      .order("nome", { ascending: true })
      .limit(limit);
    if (args.search) q = q.ilike("nome", `%${String(args.search)}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ clientes: data ?? [] }, `Retornei ${data?.length ?? 0} cliente(s).`);
  },

  "lunari.workflow.sessions.list": async (sb, uid, args) => {
    const limit = clampLimit(args.limit);
    let q = sb
      .from("clientes_sessoes")
      .select(
        "id,cliente_id,status,valor_total,valor_pago,status_financeiro,data_sessao,tipo_sessao,created_at",
      )
      .eq("user_id", uid)
      .order("data_sessao", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (args.status) q = q.eq("status", String(args.status));
    if (args.from) q = q.gte("data_sessao", String(args.from));
    if (args.to) q = q.lte("data_sessao", String(args.to));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ sessions: data ?? [] }, `Retornei ${data?.length ?? 0} sessão(ões).`);
  },

  "lunari.tasks.list": async (sb, uid, args) => {
    const limit = clampLimit(args.limit);
    let q = sb
      .from("tasks")
      .select("id,title,status,priority,due_date,cliente_id,session_id,created_at")
      .eq("user_id", uid)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (args.status) q = q.eq("status", String(args.status));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ tasks: data ?? [] }, `Retornei ${data?.length ?? 0} tarefa(s).`);
  },

  "lunari.gallery.list": async (sb, uid, args) => {
    const limit = clampLimit(args.limit);
    const { data, error } = await sb
      .from("galerias")
      .select("id,nome,status,cliente_id,total_fotos,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok({ galleries: data ?? [] }, `Retornei ${data?.length ?? 0} galeria(s).`);
  },

  "lunari.finance.summary": async (sb, uid, args) => {
    const from = args.from ? String(args.from) : null;
    const to = args.to ? String(args.to) : null;
    let q = sb
      .from("fin_transactions")
      .select("valor,tipo,data_transacao")
      .eq("user_id", uid);
    if (from) q = q.gte("data_transacao", from);
    if (to) q = q.lte("data_transacao", to);
    const { data, error } = await q;
    if (error) return fail(error.message);
    let receita = 0;
    let despesa = 0;
    for (const r of data ?? []) {
      const v = Number((r as any).valor) || 0;
      if ((r as any).tipo === "receita") receita += v;
      else if ((r as any).tipo === "despesa") despesa += v;
    }
    const saldo = receita - despesa;
    return ok(
      { receita, despesa, saldo, count: data?.length ?? 0, from, to },
      `Receita R$ ${receita.toFixed(2)} · Despesa R$ ${despesa.toFixed(2)} · Saldo R$ ${saldo.toFixed(2)}.`,
    );
  },
};

export function isBridged(toolName: string): boolean {
  return Object.prototype.hasOwnProperty.call(READ_ONLY_BRIDGE, toolName);
}

export async function runBridged(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  args: Record<string, any>,
): Promise<McpToolResult> {
  const handler = READ_ONLY_BRIDGE[toolName];
  if (!handler) return fail(`Tool "${toolName}" não está disponível para execução remota.`);
  try {
    return await handler(supabase, userId, args ?? {});
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}
