/**
 * assistant-mcp/executor.ts — Onda 1 (destravar execução remota)
 *
 * Bridge server-side real: cada tool listada aqui TEM implementação e roda com
 * Supabase service-role sempre filtrado por `user_id` do dono do token.
 *
 * Regras:
 *  - `scope: "read"`   → exige escopo read
 *  - `scope: "write"`  → exige escopo write
 *  - `requiresApproval: true` → destrutiva; primeira chamada devolve
 *    `pending_approval` e só executa com `approval_token`.
 *
 * `BRIDGE_SCHEMAS` permite publicar um schema simplificado (amigável ao
 * conector) no lugar do schema completo do catálogo — ex.: aceitar o NOME do
 * item financeiro em vez de exigir um UUID que o cliente remoto não conhece.
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

function clampLimit(n: unknown, def = 20, max = 200): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return def;
  return Math.min(Math.floor(v), max);
}
const today = () => new Date().toISOString().slice(0, 10);
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const money = (v: unknown) => `R$ ${(Number(v) || 0).toFixed(2)}`;
/** Normaliza para busca fuzzy (sem acento, minúsculo). */
function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function toMinutes(hhmm: string): number {
  const [h, m] = String(hhmm).split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
}
function fromMinutes(total: number): string {
  const h = Math.floor(total / 60), m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// -------------------- Resolvers (nome → id) --------------------

async function resolveCliente(
  sb: SupabaseClient,
  uid: string,
  args: Record<string, any>,
): Promise<{ id: string | null; nome: string | null; error?: string }> {
  const id = args.clienteId ?? args.cliente_id;
  if (id) {
    const { data } = await sb.from("clientes").select("id,nome").eq("user_id", uid).eq("id", String(id)).maybeSingle();
    if (!data) return { id: null, nome: null, error: `Cliente ${id} não encontrado.` };
    return { id: data.id, nome: data.nome };
  }
  const nome = args.clienteNome ?? args.client ?? args.cliente;
  if (!nome) return { id: null, nome: null };
  const { data } = await sb.from("clientes").select("id,nome").eq("user_id", uid).limit(500);
  const alvo = norm(nome);
  const hits = (data ?? []).filter((c: any) => norm(c.nome).includes(alvo) || alvo.includes(norm(c.nome)));
  if (hits.length === 0) return { id: null, nome: String(nome), error: `Nenhum cliente parecido com "${nome}".` };
  if (hits.length > 1) {
    const exato = hits.find((c: any) => norm(c.nome) === alvo);
    if (!exato) {
      return {
        id: null, nome: String(nome),
        error: `Vários clientes parecidos com "${nome}": ${hits.slice(0, 5).map((c: any) => c.nome).join(", ")}. Especifique clienteId.`,
      };
    }
    return { id: exato.id, nome: exato.nome };
  }
  return { id: hits[0].id, nome: hits[0].nome };
}

async function resolveFinanceItem(
  sb: SupabaseClient,
  uid: string,
  args: Record<string, any>,
): Promise<{ id: string | null; nome: string | null; grupo: string | null; error?: string }> {
  if (args.itemId) {
    const { data } = await sb.from("fin_items_master")
      .select("id,nome,grupo_principal").eq("user_id", uid).eq("id", String(args.itemId)).maybeSingle();
    if (!data) return { id: null, nome: null, grupo: null, error: `Item financeiro ${args.itemId} não encontrado.` };
    return { id: data.id, nome: data.nome, grupo: data.grupo_principal };
  }
  const termo = args.item ?? args.itemNome ?? args.fornecedor ?? args.descricao;
  if (!termo) return { id: null, nome: null, grupo: null, error: "Informe 'item' (nome do item financeiro) ou 'itemId'." };
  const { data } = await sb.from("fin_items_master")
    .select("id,nome,grupo_principal,archived_at").eq("user_id", uid).is("archived_at", null).limit(500);
  const alvo = norm(termo);
  let pool = data ?? [];
  if (args.grupo) pool = pool.filter((i: any) => norm(i.grupo_principal) === norm(args.grupo));
  const exato = pool.find((i: any) => norm(i.nome) === alvo);
  if (exato) return { id: exato.id, nome: exato.nome, grupo: exato.grupo_principal };
  const parciais = pool.filter((i: any) => norm(i.nome).includes(alvo) || alvo.includes(norm(i.nome)));
  if (parciais.length === 1) return { id: parciais[0].id, nome: parciais[0].nome, grupo: parciais[0].grupo_principal };
  if (parciais.length > 1) {
    return {
      id: null, nome: null, grupo: null,
      error: `Vários itens financeiros parecidos com "${termo}": ${parciais.slice(0, 6).map((i: any) => i.nome).join(", ")}. Escolha um.`,
    };
  }
  return {
    id: null, nome: null, grupo: null,
    error: `Nenhum item financeiro chamado "${termo}". Crie com lunari.finance.item.create (nome + grupo) ou liste com lunari.finance.item.list.`,
  };
}

const GRUPOS_RECEITA = ["Receita Operacional", "Receita Não Operacional"];

// -------------------- AGENDA --------------------

const APPT_COLS = "id,title,date,time,type,status,description,cliente_id,duration_minutes,session_id,paid_amount";

async function appointmentsInDay(sb: SupabaseClient, uid: string, date: string) {
  const { data } = await sb.from("appointments")
    .select("id,time,duration_minutes,title").eq("user_id", uid).eq("date", date);
  return data ?? [];
}

function conflictAt(
  list: any[], time: string, durationMinutes: number, excludeId?: string,
): any | null {
  const start = toMinutes(time), end = start + durationMinutes;
  for (const a of list) {
    if (excludeId && a.id === excludeId) continue;
    const s = toMinutes(String(a.time ?? "00:00"));
    const e = s + (Number(a.duration_minutes) || 60);
    if (start < e && s < end) return a;
  }
  return null;
}

const READ_TOOLS: Record<string, Handler> = {
  "lunari.agenda.appointments.list": async (sb, uid, args) => {
    const start = String(args.start ?? args.from ?? today());
    const end = String(args.end ?? args.to ?? addDays(start, 30));
    const { data, error } = await sb.from("appointments").select(APPT_COLS)
      .eq("user_id", uid).gte("date", start).lte("date", end)
      .order("date", { ascending: true }).order("time", { ascending: true }).limit(clampLimit(args.limit, 200, 500));
    if (error) return fail(error.message);
    return ok({ start, end, appointments: data ?? [] }, `${data?.length ?? 0} agendamento(s) entre ${start} e ${end}.`);
  },
  "lunari.agenda.appointments.get": async (sb, uid, args) => {
    const id = String(args.id ?? "");
    if (!id) return fail("Campo 'id' é obrigatório.");
    const { data, error } = await sb.from("appointments").select(APPT_COLS).eq("user_id", uid).eq("id", id).maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Agendamento não encontrado.");
    return ok({ appointment: data }, `${data.title} — ${data.date} ${data.time} (${data.status}).`);
  },
  "lunari.agenda.slot.check": async (sb, uid, args) => {
    const date = String(args.date ?? ""), time = String(args.time ?? "");
    if (!date || !time) return fail("Campos 'date' (YYYY-MM-DD) e 'time' (HH:MM) são obrigatórios.");
    const duration = Number(args.durationMinutes) || 60;
    const list = await appointmentsInDay(sb, uid, date);
    const c = conflictAt(list, time, duration, args.excludeAppointmentId ? String(args.excludeAppointmentId) : undefined);
    return ok(
      { date, time, available: !c, conflict: c ?? null },
      c ? `Ocupado: "${c.title}" às ${c.time}.` : `Horário livre em ${date} às ${time}.`,
    );
  },
  "lunari.agenda.availability.findNext": async (sb, uid, args) => {
    const fromDate = String(args.fromDate ?? today());
    const fromTime = String(args.fromTime ?? "08:00");
    const horizon = Math.min(Number(args.horizonDays) || 30, 180);
    const duration = Number(args.durationMinutes) || 60;
    const dayStart = toMinutes(String(args.dayStart ?? "08:00"));
    const dayEnd = toMinutes(String(args.dayEnd ?? "19:00"));
    const endDate = addDays(fromDate, horizon);
    const { data, error } = await sb.from("appointments")
      .select("id,date,time,duration_minutes,title").eq("user_id", uid).gte("date", fromDate).lte("date", endDate);
    if (error) return fail(error.message);
    const byDay = new Map<string, any[]>();
    for (const a of data ?? []) {
      const k = String((a as any).date);
      byDay.set(k, [...(byDay.get(k) ?? []), a]);
    }
    const slots: { date: string; time: string }[] = [];
    for (let d = 0; d <= horizon && slots.length < 5; d++) {
      const date = addDays(fromDate, d);
      const list = byDay.get(date) ?? [];
      const min = d === 0 ? Math.max(dayStart, toMinutes(fromTime)) : dayStart;
      for (let t = min; t + duration <= dayEnd && slots.length < 5; t += 30) {
        const time = fromMinutes(t);
        if (!conflictAt(list, time, duration)) slots.push({ date, time });
      }
    }
    if (!slots.length) return ok({ slots: [] }, `Nenhum horário livre nos próximos ${horizon} dias.`);
    return ok({ slots, next: slots[0] }, `Próximo horário livre: ${slots[0].date} às ${slots[0].time}.`);
  },

  // -------------------- CLIENTES --------------------
  "lunari.clientes.list": async (sb, uid, args) => {
    let q = sb.from("clientes").select("id,nome,email,telefone,whatsapp,cidade,created_at")
      .eq("user_id", uid).order("nome").limit(clampLimit(args.limit, 50, 200));
    if (args.search ?? args.q) q = q.ilike("nome", `%${String(args.search ?? args.q)}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ clientes: data ?? [] }, `${data?.length ?? 0} cliente(s).`);
  },
  "lunari.clientes.search": async (sb, uid, args) => {
    const q = String(args.q ?? "").trim();
    if (!q) return fail("Campo 'q' é obrigatório.");
    const { data, error } = await sb.from("clientes")
      .select("id,nome,email,telefone,whatsapp").eq("user_id", uid)
      .or(`nome.ilike.%${q}%,email.ilike.%${q}%,telefone.ilike.%${q}%,whatsapp.ilike.%${q}%`).limit(20);
    if (error) return fail(error.message);
    return ok({ clientes: data ?? [] }, `${data?.length ?? 0} cliente(s) para "${q}".`);
  },
  "lunari.clientes.get": async (sb, uid, args) => {
    const id = String(args.id ?? "");
    if (!id) return fail("Campo 'id' é obrigatório.");
    const { data, error } = await sb.from("clientes").select("*").eq("user_id", uid).eq("id", id).maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Cliente não encontrado.");
    return ok({ cliente: data }, `Cliente ${data.nome}.`);
  },
  "lunari.clientes.listSessoes": async (sb, uid, args) => {
    const clienteId = String(args.clienteId ?? "");
    if (!clienteId) return fail("Campo 'clienteId' é obrigatório.");
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,data_sessao,hora_sessao,categoria,pacote,status,valor_total,valor_pago,status_financeiro")
      .eq("user_id", uid).eq("cliente_id", clienteId)
      .order("data_sessao", { ascending: false }).limit(clampLimit(args.limit, 20, 200));
    if (error) return fail(error.message);
    return ok({ sessoes: data ?? [] }, `${data?.length ?? 0} sessão(ões) do cliente.`);
  },

  // -------------------- TAREFAS --------------------
  "lunari.tasks.list": async (sb, uid, args) => {
    let q = sb.from("tasks")
      .select("id,title,status,priority,due_date,category,type,related_cliente_id,related_session_id,checklist_items,notes")
      .eq("user_id", uid).order("due_date", { ascending: true, nullsFirst: false })
      .limit(clampLimit(args.limit, 50, 500));
    if (args.status) q = q.eq("status", String(args.status));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ tasks: data ?? [] }, `${data?.length ?? 0} tarefa(s).`);
  },
  "lunari.tasks.dueOverview": async (sb, uid) => {
    const hoje = today();
    const { data, error } = await sb.from("tasks")
      .select("id,title,status,priority,due_date").eq("user_id", uid).neq("status", "done")
      .not("due_date", "is", null).order("due_date").limit(200);
    if (error) return fail(error.message);
    const atrasadas = (data ?? []).filter((t: any) => t.due_date < hoje);
    const hojeList = (data ?? []).filter((t: any) => t.due_date === hoje);
    const proximas = (data ?? []).filter((t: any) => t.due_date > hoje && t.due_date <= addDays(hoje, 7));
    return ok(
      { atrasadas, hoje: hojeList, proximos7dias: proximas },
      `${atrasadas.length} atrasada(s), ${hojeList.length} para hoje, ${proximas.length} nos próximos 7 dias.`,
    );
  },

  // -------------------- WORKFLOW / SESSÕES --------------------
  "lunari.workflow.search": async (sb, uid, args) => {
    let q = sb.from("clientes_sessoes")
      .select("id,session_id,cliente_id,data_sessao,categoria,pacote,status,valor_total,valor_pago,status_financeiro,descricao")
      .eq("user_id", uid).order("data_sessao", { ascending: false }).limit(clampLimit(args.limit, 20, 100));
    if (args.status) q = q.eq("status", String(args.status));
    if (args.categoria) q = q.eq("categoria", String(args.categoria));
    if (args.year && args.month) {
      const start = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
      q = q.gte("data_sessao", start).lte("data_sessao", addDays(start, 31));
    }
    if (args.q) q = q.or(`descricao.ilike.%${args.q}%,pacote.ilike.%${args.q}%,categoria.ilike.%${args.q}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ sessoes: data ?? [] }, `${data?.length ?? 0} sessão(ões) encontradas.`);
  },
  "lunari.workflow.listMonth": async (sb, uid, args) => {
    const year = Number(args.year), month = Number(args.month);
    if (!year || !month) return fail("Campos 'year' e 'month' são obrigatórios.");
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = addDays(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`, -1);
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,cliente_id,data_sessao,hora_sessao,categoria,pacote,status,valor_total,valor_pago,status_financeiro")
      .eq("user_id", uid).gte("data_sessao", start).lte("data_sessao", end).order("data_sessao").limit(500);
    if (error) return fail(error.message);
    const total = (data ?? []).reduce((s: number, r: any) => s + (Number(r.valor_total) || 0), 0);
    const pago = (data ?? []).reduce((s: number, r: any) => s + (Number(r.valor_pago) || 0), 0);
    return ok(
      { start, end, sessoes: data ?? [], totals: { valorTotal: total, valorPago: pago, pendente: total - pago } },
      `${data?.length ?? 0} sessão(ões) em ${start.slice(0, 7)} · total ${money(total)} · pago ${money(pago)}.`,
    );
  },
  "lunari.workflow.listRange": async (sb, uid, args) => {
    const start = String(args.startDate ?? args.start ?? today());
    const end = String(args.endDate ?? args.end ?? addDays(start, 30));
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,cliente_id,data_sessao,categoria,pacote,status,valor_total,valor_pago,status_financeiro")
      .eq("user_id", uid).gte("data_sessao", start).lte("data_sessao", end)
      .order("data_sessao").limit(clampLimit(args.limit, 500, 1000));
    if (error) return fail(error.message);
    return ok({ start, end, sessoes: data ?? [] }, `${data?.length ?? 0} sessão(ões) entre ${start} e ${end}.`);
  },
  "lunari.workflow.pendingPayments": async (sb, uid, args) => {
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,cliente_id,data_sessao,pacote,valor_total,valor_pago,status_financeiro")
      .eq("user_id", uid).neq("status_financeiro", "pago")
      .order("data_sessao", { ascending: false }).limit(clampLimit(args.limit, 50, 200));
    if (error) return fail(error.message);
    const pendente = (data ?? []).reduce((s: number, r: any) => s + ((Number(r.valor_total) || 0) - (Number(r.valor_pago) || 0)), 0);
    return ok({ sessoes: data ?? [], totalPendente: pendente }, `${data?.length ?? 0} sessão(ões) com ${money(pendente)} pendente(s).`);
  },

  // -------------------- FINANCEIRO --------------------
  "lunari.finance.item.list": async (sb, uid, args) => {
    let q = sb.from("fin_items_master").select("id,nome,grupo_principal,group_code,ativo")
      .eq("user_id", uid).is("archived_at", null).order("nome").limit(500);
    if (args.grupo) q = q.eq("grupo_principal", String(args.grupo));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ itens: data ?? [] }, `${data?.length ?? 0} item(ns) financeiro(s).`);
  },
  "lunari.finance.extrato.list": async (sb, uid, args) => {
    const dataInicio = String(args.dataInicio ?? addDays(today(), -30));
    const dataFim = String(args.dataFim ?? today());
    let q = sb.from("fin_transactions")
      .select("id,valor,status,data_vencimento,data_competencia,observacoes,parcela_atual,parcela_total,item_id,fin_items_master(nome,grupo_principal)")
      .eq("user_id", uid).gte("data_vencimento", dataInicio).lte("data_vencimento", dataFim)
      .order("data_vencimento", { ascending: false }).limit(clampLimit(args.pageSize, 50, 200));
    if (args.status && args.status !== "todos") q = q.eq("status", String(args.status));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ dataInicio, dataFim, lancamentos: data ?? [] }, `${data?.length ?? 0} lançamento(s) entre ${dataInicio} e ${dataFim}.`);
  },
  "lunari.finance.extrato.summary": async (sb, uid, args) => {
    const dataInicio = String(args.dataInicio ?? addDays(today(), -30));
    const dataFim = String(args.dataFim ?? today());
    const { data, error } = await sb.from("fin_transactions")
      .select("valor,status,fin_items_master(grupo_principal)")
      .eq("user_id", uid).gte("data_vencimento", dataInicio).lte("data_vencimento", dataFim);
    if (error) return fail(error.message);
    let entradas = 0, saidas = 0, pago = 0, aberto = 0;
    for (const r of (data ?? []) as any[]) {
      const v = Number(r.valor) || 0;
      const grupo = r.fin_items_master?.grupo_principal ?? "";
      if (GRUPOS_RECEITA.includes(grupo)) entradas += v; else saidas += v;
      if (r.status === "Pago") pago += v; else aberto += v;
    }
    return ok(
      { dataInicio, dataFim, entradas, saidas, saldo: entradas - saidas, pago, emAberto: aberto, count: data?.length ?? 0 },
      `Entradas ${money(entradas)} · Saídas ${money(saidas)} · Saldo ${money(entradas - saidas)} (${dataInicio}→${dataFim}).`,
    );
  },
};

// -------------------- MUTAÇÕES --------------------
type WriteCfg = { handler: Handler; requiresApproval: boolean; summarize: (a: Record<string, any>) => string };

const WRITE_HANDLERS: Record<string, WriteCfg> = {
  // ---------- AGENDA ----------
  "lunari.agenda.appointments.create": {
    requiresApproval: false,
    summarize: (a) => `Criar agendamento "${a.title ?? a.type ?? "sessão"}" em ${a.date ?? "?"} ${a.time ?? ""}`,
    handler: async (sb, uid, args) => {
      const date = String(args.date ?? ""), time = String(args.time ?? "");
      if (!date || !time) return fail("Campos 'date' (YYYY-MM-DD) e 'time' (HH:MM) são obrigatórios.");
      const cli = await resolveCliente(sb, uid, args);
      if (cli.error) return fail(cli.error);
      const title = String(args.title ?? cli.nome ?? "Agendamento");
      const duration = Number(args.durationMinutes) || 60;
      const conflict = conflictAt(await appointmentsInDay(sb, uid, date), time, duration);
      if (conflict && !args.force) {
        return fail(`Conflito com "${conflict.title}" às ${conflict.time}. Escolha outro horário ou envie force=true.`);
      }
      const payload: Record<string, unknown> = {
        user_id: uid,
        session_id: crypto.randomUUID(),
        title,
        date,
        time,
        type: String(args.type ?? args.categoria ?? "Sessão"),
        status: String(args.status ?? "a confirmar"),
        description: args.description ? String(args.description) : null,
        cliente_id: cli.id,
        duration_minutes: duration,
        origem: "agenda",
      };
      const { data, error } = await sb.from("appointments").insert(payload).select(APPT_COLS).single();
      if (error) return fail(error.message);
      return ok({ appointment: data }, `Agendamento "${title}" criado em ${date} às ${time}.`);
    },
  },
  "lunari.agenda.appointments.update": {
    requiresApproval: false,
    summarize: (a) => `Atualizar agendamento ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const patch = (args.patch ?? args) as Record<string, any>;
      const upd: Record<string, unknown> = {};
      if (patch.title != null) upd.title = String(patch.title);
      if (patch.date != null) upd.date = String(patch.date);
      if (patch.time != null) upd.time = String(patch.time);
      if (patch.type != null) upd.type = String(patch.type);
      if (patch.status != null) upd.status = String(patch.status);
      if (patch.description != null) upd.description = String(patch.description);
      if (patch.durationMinutes != null) upd.duration_minutes = Number(patch.durationMinutes);
      if (patch.clienteId != null || patch.clienteNome != null) {
        const cli = await resolveCliente(sb, uid, patch);
        if (cli.error) return fail(cli.error);
        upd.cliente_id = cli.id;
      }
      if (!Object.keys(upd).length) return fail("Nada para atualizar.");
      const { data, error } = await sb.from("appointments").update(upd)
        .eq("id", id).eq("user_id", uid).select(APPT_COLS).maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Agendamento não encontrado.");
      return ok({ appointment: data }, `Agendamento "${data.title}" atualizado.`);
    },
  },
  "lunari.agenda.appointments.reschedule": {
    requiresApproval: false,
    summarize: (a) => `Remarcar agendamento ${a.id ?? "?"} para ${a.date ?? "?"} ${a.time ?? ""}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? ""), date = String(args.date ?? ""), time = String(args.time ?? "");
      if (!id || !date || !time) return fail("Campos 'id', 'date' e 'time' são obrigatórios.");
      const { data: atual } = await sb.from("appointments").select("id,duration_minutes,title,description")
        .eq("user_id", uid).eq("id", id).maybeSingle();
      if (!atual) return fail("Agendamento não encontrado.");
      const duration = Number(atual.duration_minutes) || 60;
      const conflict = conflictAt(await appointmentsInDay(sb, uid, date), time, duration, id);
      if (conflict && !args.force) return fail(`Conflito com "${conflict.title}" às ${conflict.time}.`);
      const upd: Record<string, unknown> = { date, time };
      if (args.reason) upd.description = `${atual.description ?? ""}\n[Remarcado] ${args.reason}`.trim();
      const { data, error } = await sb.from("appointments").update(upd)
        .eq("id", id).eq("user_id", uid).select(APPT_COLS).single();
      if (error) return fail(error.message);
      return ok({ appointment: data }, `"${data.title}" remarcado para ${date} às ${time}.`);
    },
  },
  "lunari.agenda.appointments.confirm": {
    requiresApproval: false,
    summarize: (a) => `Confirmar agendamento ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { data, error } = await sb.from("appointments").update({ status: "confirmado" })
        .eq("id", id).eq("user_id", uid).select(APPT_COLS).maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Agendamento não encontrado.");
      return ok({ appointment: data }, `"${data.title}" confirmado.`);
    },
  },

  // ---------- CLIENTES ----------
  "lunari.clientes.create": {
    requiresApproval: false,
    summarize: (a) => `Criar cliente "${a.nome ?? "sem nome"}"`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) return fail("Campo 'nome' é obrigatório.");
      const payload: Record<string, unknown> = { user_id: uid, nome };
      for (const f of ["email", "telefone", "whatsapp", "cidade", "uf", "cpf_cnpj", "observacoes", "origem"]) {
        if (args[f] != null) payload[f] = String(args[f]);
      }
      const { data, error } = await sb.from("clientes").insert(payload).select("id,nome,email,telefone").single();
      if (error) return fail(error.message);
      return ok({ cliente: data }, `Cliente "${data.nome}" criado.`);
    },
  },
  "lunari.clientes.update": {
    requiresApproval: false,
    summarize: (a) => `Atualizar cliente ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const upd: Record<string, unknown> = {};
      for (const f of ["nome", "email", "telefone", "whatsapp", "cidade", "uf", "cpf_cnpj", "observacoes"]) {
        if (args[f] !== undefined) upd[f] = args[f] === null ? null : String(args[f]);
      }
      if (!Object.keys(upd).length) return fail("Nada para atualizar.");
      const { data, error } = await sb.from("clientes").update(upd)
        .eq("id", id).eq("user_id", uid).select("id,nome").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Cliente não encontrado.");
      return ok({ cliente: data }, `Cliente "${data.nome}" atualizado.`);
    },
  },

  // ---------- TAREFAS ----------
  "lunari.tasks.create": {
    requiresApproval: false,
    summarize: (a) => `Criar tarefa "${a.title ?? "sem título"}"`,
    handler: async (sb, uid, args) => {
      const title = String(args.title ?? "").trim();
      if (!title) return fail("Campo 'title' é obrigatório.");
      const checklist = Array.isArray(args.checklistItems)
        ? args.checklistItems.map((it: any, i: number) =>
          typeof it === "string"
            ? { id: crypto.randomUUID(), text: it, done: false, order: i }
            : { id: it.id ?? crypto.randomUUID(), text: String(it.text ?? it.title ?? ""), done: !!it.done, order: i })
        : [];
      const payload: Record<string, unknown> = {
        user_id: uid,
        title,
        description: args.description ? String(args.description) : null,
        notes: args.notes ? String(args.notes) : null,
        status: String(args.status ?? "todo"),
        priority: String(args.priority ?? "medium"),
        due_date: args.dueDate ? String(args.dueDate).slice(0, 10) : null,
        category: args.category ? String(args.category) : null,
        type: args.type ? String(args.type) : null,
        source: String(args.source ?? "ai"),
        checklist_items: checklist,
        estimated_hours: args.estimatedHours != null ? Number(args.estimatedHours) : null,
        related_cliente_id: args.relatedClienteId ? String(args.relatedClienteId) : null,
        related_session_id: args.relatedSessionId ? String(args.relatedSessionId) : null,
      };
      if (!payload.related_cliente_id && (args.clienteNome || args.cliente)) {
        const cli = await resolveCliente(sb, uid, args);
        if (cli.id) payload.related_cliente_id = cli.id;
      }
      const { data, error } = await sb.from("tasks").insert(payload).select("id,title,status,due_date,priority").single();
      if (error) return fail(error.message);
      return ok({ task: data }, `Tarefa "${data.title}" criada${data.due_date ? ` para ${data.due_date}` : ""}.`);
    },
  },
  "lunari.tasks.update": {
    requiresApproval: false,
    summarize: (a) => `Atualizar tarefa ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const patch = (args.patch ?? args) as Record<string, any>;
      const upd: Record<string, unknown> = {};
      if (patch.title != null) upd.title = String(patch.title);
      if (patch.description !== undefined) upd.description = patch.description === null ? null : String(patch.description);
      if (patch.notes !== undefined) upd.notes = patch.notes === null ? null : String(patch.notes);
      if (patch.status != null) upd.status = String(patch.status);
      if (patch.priority != null) upd.priority = String(patch.priority);
      if (patch.dueDate !== undefined) upd.due_date = patch.dueDate ? String(patch.dueDate).slice(0, 10) : null;
      if (patch.category !== undefined) upd.category = patch.category ? String(patch.category) : null;
      if (Array.isArray(patch.checklistItems)) upd.checklist_items = patch.checklistItems;
      if (patch.estimatedHours != null) upd.estimated_hours = Number(patch.estimatedHours);
      if (!Object.keys(upd).length) return fail("Nada para atualizar.");
      const { data, error } = await sb.from("tasks").update(upd)
        .eq("id", id).eq("user_id", uid).select("id,title,status,due_date").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Tarefa não encontrada.");
      return ok({ task: data }, `Tarefa "${data.title}" atualizada.`);
    },
  },
  "lunari.tasks.move": {
    requiresApproval: false,
    summarize: (a) => `Mover tarefa ${a.id ?? "?"} para ${a.toStatus ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? ""), toStatus = String(args.toStatus ?? "");
      if (!id || !toStatus) return fail("Campos 'id' e 'toStatus' são obrigatórios.");
      const upd: Record<string, unknown> = { status: toStatus };
      upd.completed_at = toStatus === "done" ? new Date().toISOString() : null;
      const { data, error } = await sb.from("tasks").update(upd)
        .eq("id", id).eq("user_id", uid).select("id,title,status").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Tarefa não encontrada.");
      return ok({ task: data }, `Tarefa "${data.title}" movida para ${toStatus}.`);
    },
  },
  "lunari.tasks.complete": {
    requiresApproval: false,
    summarize: (a) => `Concluir tarefa ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { data, error } = await sb.from("tasks")
        .update({ status: "done", checked: true, completed_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", uid).select("id,title,status").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Tarefa não encontrada.");
      return ok({ task: data }, `Tarefa "${data.title}" concluída.`);
    },
  },
  "lunari.tasks.reopen": {
    requiresApproval: false,
    summarize: (a) => `Reabrir tarefa ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { data, error } = await sb.from("tasks")
        .update({ status: String(args.toStatus ?? "todo"), checked: false, completed_at: null })
        .eq("id", id).eq("user_id", uid).select("id,title,status").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Tarefa não encontrada.");
      return ok({ task: data }, `Tarefa "${data.title}" reaberta.`);
    },
  },

  // ---------- FINANCEIRO ----------
  "lunari.finance.item.create": {
    requiresApproval: false,
    summarize: (a) => `Criar item financeiro "${a.nome ?? "?"}" (${a.grupo ?? "?"})`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      const grupo = String(args.grupo ?? "").trim();
      if (!nome || !grupo) return fail("Campos 'nome' e 'grupo' são obrigatórios.");
      const { data, error } = await sb.from("fin_items_master")
        .insert({ user_id: uid, nome, grupo_principal: grupo, ativo: true })
        .select("id,nome,grupo_principal").single();
      if (error) return fail(error.message);
      return ok({ item: data }, `Item "${data.nome}" criado em ${data.grupo_principal}.`);
    },
  },
  "lunari.finance.transaction.create": {
    requiresApproval: false,
    summarize: (a) =>
      `Lançar ${money(a.valor)}${a.item ? ` em "${a.item}"` : ""}${a.observacoes ? ` — ${a.observacoes}` : ""}`,
    handler: async (sb, uid, args) => {
      const valor = Number(args.valor);
      if (!Number.isFinite(valor) || valor <= 0) return fail("Campo 'valor' inválido.");
      const item = await resolveFinanceItem(sb, uid, args);
      if (item.error) return fail(item.error);
      const vencimento = String(args.dataVencimento ?? args.data ?? today());
      const payload: Record<string, unknown> = {
        user_id: uid,
        item_id: item.id,
        valor,
        data_vencimento: vencimento,
        data_competencia: args.dataCompetencia ? String(args.dataCompetencia) : vencimento,
        status: String(args.status ?? "Pago"),
        observacoes: args.observacoes ? String(args.observacoes).slice(0, 500) : null,
      };
      if (args.dataCompra) payload.data_compra = String(args.dataCompra);
      const { data, error } = await sb.from("fin_transactions").insert(payload)
        .select("id,valor,status,data_vencimento").single();
      if (error) return fail(error.message);
      const natureza = GRUPOS_RECEITA.includes(item.grupo ?? "") ? "Receita" : "Despesa";
      return ok(
        { transacao: data, item: { id: item.id, nome: item.nome, grupo: item.grupo } },
        `${natureza} de ${money(valor)} em "${item.nome}" lançada (${data.status}, venc. ${data.data_vencimento}).`,
      );
    },
  },
  "lunari.finance.transaction.markPaid": {
    requiresApproval: false,
    summarize: (a) => `Marcar lançamento ${a.id ?? "?"} como pago`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const upd: Record<string, unknown> = { status: "Pago" };
      if (args.dataPagamento) upd.data_vencimento = String(args.dataPagamento);
      const { data, error } = await sb.from("fin_transactions").update(upd)
        .eq("id", id).eq("user_id", uid).select("id,valor,status").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Lançamento não encontrado.");
      return ok({ transacao: data }, `Lançamento de ${money(data.valor)} marcado como pago.`);
    },
  },
  "lunari.finance.transaction.delete": {
    requiresApproval: true,
    summarize: (a) => `Excluir lançamento financeiro ${a.id ?? "?"} (irreversível)`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { error } = await sb.from("fin_transactions").delete().eq("id", id).eq("user_id", uid);
      if (error) return fail(error.message);
      return ok({ deleted: id }, "Lançamento excluído.");
    },
  },
  "lunari.tasks.delete": {
    requiresApproval: true,
    summarize: (a) => `Excluir tarefa ${a.id ?? "?"} (irreversível)`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { error } = await sb.from("tasks").delete().eq("id", id).eq("user_id", uid);
      if (error) return fail(error.message);
      return ok({ deleted: id }, "Tarefa excluída.");
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

/**
 * Schemas simplificados publicados em `tools/list` no lugar do schema do
 * catálogo — o cliente remoto não conhece UUIDs internos.
 */
export const BRIDGE_SCHEMAS: Record<string, Record<string, unknown>> = {
  "lunari.agenda.appointments.create": {
    type: "object",
    properties: {
      title: { type: "string", description: "Título do agendamento." },
      date: { type: "string", description: "Data YYYY-MM-DD." },
      time: { type: "string", description: "Hora HH:MM." },
      type: { type: "string", description: "Categoria/tipo (ex.: Newborn, Família)." },
      status: { type: "string", enum: ["confirmado", "a confirmar"] },
      clienteId: { type: "string", description: "UUID do cliente (opcional)." },
      clienteNome: { type: "string", description: "Nome do cliente — resolvido automaticamente." },
      description: { type: "string" },
      durationMinutes: { type: "number", description: "Duração em minutos (padrão 60)." },
      force: { type: "boolean", description: "Criar mesmo havendo conflito de horário." },
    },
    required: ["date", "time"],
    additionalProperties: false,
  },
  "lunari.agenda.appointments.update": {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      date: { type: "string" },
      time: { type: "string" },
      type: { type: "string" },
      status: { type: "string", enum: ["confirmado", "a confirmar"] },
      description: { type: "string" },
      durationMinutes: { type: "number" },
      clienteNome: { type: "string" },
      clienteId: { type: "string" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  "lunari.tasks.create": {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      notes: { type: "string" },
      dueDate: { type: "string", description: "Data YYYY-MM-DD." },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      status: { type: "string", description: "todo (padrão) ou done." },
      category: { type: "string" },
      checklistItems: { type: "array", items: { type: "string" }, description: "Itens do checklist." },
      clienteNome: { type: "string", description: "Vincula a tarefa a um cliente pelo nome." },
      relatedSessionId: { type: "string" },
    },
    required: ["title"],
    additionalProperties: false,
  },
  "lunari.tasks.update": {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      notes: { type: "string" },
      dueDate: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      status: { type: "string" },
      category: { type: "string" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  "lunari.finance.transaction.create": {
    type: "object",
    properties: {
      valor: { type: "number", description: "Valor em reais (positivo)." },
      item: { type: "string", description: "Nome do item financeiro (ex.: 'Schlosser', 'Aluguel'). Resolvido por busca." },
      itemId: { type: "string", description: "UUID do item (alternativa a 'item')." },
      grupo: {
        type: "string",
        description: "Filtra a busca do item pelo grupo.",
        enum: ["Despesa Fixa", "Despesa Variável", "Investimento", "Receita Não Operacional", "Receita Operacional"],
      },
      dataVencimento: { type: "string", description: "YYYY-MM-DD (padrão: hoje)." },
      dataCompetencia: { type: "string", description: "YYYY-MM-DD." },
      status: { type: "string", enum: ["Pago", "Agendado", "Faturado"], description: "Padrão: Pago." },
      observacoes: { type: "string" },
    },
    required: ["valor"],
    additionalProperties: false,
  },
  "lunari.agenda.slot.check": {
    type: "object",
    properties: {
      date: { type: "string" },
      time: { type: "string" },
      durationMinutes: { type: "number" },
      excludeAppointmentId: { type: "string" },
    },
    required: ["date", "time"],
    additionalProperties: false,
  },
  "lunari.agenda.availability.findNext": {
    type: "object",
    properties: {
      fromDate: { type: "string", description: "YYYY-MM-DD (padrão: hoje)." },
      fromTime: { type: "string", description: "HH:MM (padrão: 08:00)." },
      horizonDays: { type: "number", description: "Janela de busca em dias (padrão 30)." },
      durationMinutes: { type: "number" },
    },
    additionalProperties: false,
  },
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
