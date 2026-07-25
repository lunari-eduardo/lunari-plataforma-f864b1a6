/**
 * assistant-mcp/executor.ts — Onda F.3
 *
 * Bridge server-side com:
 *  - Whitelist de leituras (F.2)
 *  - Whitelist de MUTAÇÕES (F.3) com escopos + gate de aprovação
 *
 * Tools destrutivas retornam `pending_approval` na primeira chamada; o cliente
 * MCP então chama a mesma tool novamente enviando `approval_token` (obtido
 * pelo fotógrafo no app em /assistente/aprovacoes) para executar de fato.
 */
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface McpContent { type: "text"; text: string }
export interface McpToolResult {
  content: McpContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  /** Sinaliza ao index que a resposta é um pedido de aprovação (não erro real). */
  _pendingApproval?: { approvalId: string; expiresAt: string };
}

type Handler = (
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, any>,
) => Promise<McpToolResult>;

export interface BridgedTool {
  handler: Handler;
  scope: "read" | "write";
  requiresApproval: boolean;
  /** Resumo curto exibido para o fotógrafo no card de aprovação. */
  summarize?: (args: Record<string, any>) => string;
}

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

// -------------------- LEITURAS (F.2) --------------------
const READ_TOOLS: Record<string, Handler> = {
  "lunari.agenda.appointments.list": async (sb, uid, args) => {
    const limit = clampLimit(args.limit);
    let q = sb.from("appointments")
      .select("id,title,date,time,status,type,cliente_id,duration_minutes")
      .eq("user_id", uid).order("date", { ascending: false }).limit(limit);
    if (args.from) q = q.gte("date", String(args.from));
    if (args.to) q = q.lte("date", String(args.to));
    if (args.status) q = q.eq("status", String(args.status));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ appointments: data ?? [] }, `Retornei ${data?.length ?? 0} agendamento(s).`);
  },
  "lunari.clientes.list": async (sb, uid, args) => {
    const limit = clampLimit(args.limit);
    let q = sb.from("clientes")
      .select("id,nome,email,telefone,created_at")
      .eq("user_id", uid).order("nome", { ascending: true }).limit(limit);
    if (args.search) q = q.ilike("nome", `%${String(args.search)}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ clientes: data ?? [] }, `Retornei ${data?.length ?? 0} cliente(s).`);
  },
  "lunari.workflow.sessions.list": async (sb, uid, args) => {
    const limit = clampLimit(args.limit);
    let q = sb.from("clientes_sessoes")
      .select("id,cliente_id,status,valor_total,valor_pago,status_financeiro,data_sessao,tipo_sessao,created_at")
      .eq("user_id", uid).order("data_sessao", { ascending: false, nullsFirst: false }).limit(limit);
    if (args.status) q = q.eq("status", String(args.status));
    if (args.from) q = q.gte("data_sessao", String(args.from));
    if (args.to) q = q.lte("data_sessao", String(args.to));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ sessions: data ?? [] }, `Retornei ${data?.length ?? 0} sessão(ões).`);
  },
  "lunari.tasks.list": async (sb, uid, args) => {
    const limit = clampLimit(args.limit);
    let q = sb.from("tasks")
      .select("id,title,status,priority,due_date,cliente_id,session_id,created_at")
      .eq("user_id", uid).order("due_date", { ascending: true, nullsFirst: false }).limit(limit);
    if (args.status) q = q.eq("status", String(args.status));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ tasks: data ?? [] }, `Retornei ${data?.length ?? 0} tarefa(s).`);
  },
  "lunari.gallery.list": async (sb, uid, args) => {
    const limit = clampLimit(args.limit);
    const { data, error } = await sb.from("galerias")
      .select("id,nome,status,cliente_id,total_fotos,created_at")
      .eq("user_id", uid).order("created_at", { ascending: false }).limit(limit);
    if (error) return fail(error.message);
    return ok({ galleries: data ?? [] }, `Retornei ${data?.length ?? 0} galeria(s).`);
  },
  "lunari.finance.summary": async (sb, uid, args) => {
    const from = args.from ? String(args.from) : null;
    const to = args.to ? String(args.to) : null;
    let q = sb.from("fin_transactions").select("valor,tipo,data_transacao").eq("user_id", uid);
    if (from) q = q.gte("data_transacao", from);
    if (to) q = q.lte("data_transacao", to);
    const { data, error } = await q;
    if (error) return fail(error.message);
    let receita = 0, despesa = 0;
    for (const r of data ?? []) {
      const v = Number((r as any).valor) || 0;
      if ((r as any).tipo === "receita") receita += v;
      else if ((r as any).tipo === "despesa") despesa += v;
    }
    return ok(
      { receita, despesa, saldo: receita - despesa, count: data?.length ?? 0, from, to },
      `Receita R$ ${receita.toFixed(2)} · Despesa R$ ${despesa.toFixed(2)} · Saldo R$ ${(receita - despesa).toFixed(2)}.`,
    );
  },
};

// -------------------- MUTAÇÕES (F.3) --------------------
const WRITE_HANDLERS: Record<string, { handler: Handler; requiresApproval: boolean; summarize: (a: Record<string, any>) => string }> = {
  "lunari.clientes.create": {
    requiresApproval: false,
    summarize: (a) => `Criar cliente "${a.nome ?? "sem nome"}"`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) return fail("Campo 'nome' é obrigatório.");
      const payload: Record<string, unknown> = { user_id: uid, nome };
      if (args.email) payload.email = String(args.email);
      if (args.telefone) payload.telefone = String(args.telefone);
      const { data, error } = await sb.from("clientes").insert(payload).select("id,nome").single();
      if (error) return fail(error.message);
      return ok({ cliente: data }, `Cliente "${data?.nome}" criado.`);
    },
  },
  "lunari.tasks.complete": {
    requiresApproval: false,
    summarize: (a) => `Marcar tarefa ${a.id ?? "?"} como concluída`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { data, error } = await sb.from("tasks")
        .update({ status: "concluida", completed_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", uid).select("id,title,status").single();
      if (error) return fail(error.message);
      return ok({ task: data }, `Tarefa "${data?.title}" concluída.`);
    },
  },
  "lunari.finance.transaction.create": {
    requiresApproval: true,
    summarize: (a) =>
      `Registrar ${a.tipo ?? "transação"} de R$ ${Number(a.valor ?? 0).toFixed(2)}${a.descricao ? ` — ${a.descricao}` : ""}`,
    handler: async (sb, uid, args) => {
      const valor = Number(args.valor);
      const tipo = String(args.tipo ?? "receita");
      if (!Number.isFinite(valor) || valor <= 0) return fail("Valor inválido.");
      if (tipo !== "receita" && tipo !== "despesa") return fail("Tipo deve ser receita ou despesa.");
      const payload: Record<string, unknown> = {
        user_id: uid, valor, tipo,
        descricao: args.descricao ? String(args.descricao) : null,
        data_transacao: args.data ? String(args.data) : new Date().toISOString().slice(0, 10),
      };
      const { data, error } = await sb.from("fin_transactions").insert(payload).select("id,valor,tipo").single();
      if (error) return fail(error.message);
      return ok({ transacao: data }, `${tipo === "receita" ? "Receita" : "Despesa"} de R$ ${valor.toFixed(2)} registrada.`);
    },
  },
  "lunari.clientes.delete": {
    requiresApproval: true,
    summarize: (a) => `Excluir cliente ${a.id ?? "?"} (ação irreversível)`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { error } = await sb.from("clientes").delete().eq("id", id).eq("user_id", uid);
      if (error) return fail(error.message);
      return ok({ deleted: id }, `Cliente removido.`);
    },
  },
};

export const BRIDGED_TOOLS: Record<string, BridgedTool> = {
  ...Object.fromEntries(
    Object.entries(READ_TOOLS).map(([name, handler]) => [name, { handler, scope: "read", requiresApproval: false } as BridgedTool]),
  ),
  ...Object.fromEntries(
    Object.entries(WRITE_HANDLERS).map(([name, cfg]) => [
      name,
      { handler: cfg.handler, scope: "write", requiresApproval: cfg.requiresApproval, summarize: cfg.summarize } as BridgedTool,
    ]),
  ),
};

/** Kept for backwards compatibility with existing GET metadata response. */
export const READ_ONLY_BRIDGE = READ_TOOLS;

export function isBridged(toolName: string): boolean {
  return Object.prototype.hasOwnProperty.call(BRIDGED_TOOLS, toolName);
}

export function getBridged(toolName: string): BridgedTool | null {
  return BRIDGED_TOOLS[toolName] ?? null;
}

export async function runBridged(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  args: Record<string, any>,
): Promise<McpToolResult> {
  const tool = BRIDGED_TOOLS[toolName];
  if (!tool) return fail(`Tool "${toolName}" não está disponível para execução remota.`);
  try {
    return await tool.handler(supabase, userId, args ?? {});
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

export { fail as bridgeFail, ok as bridgeOk };
