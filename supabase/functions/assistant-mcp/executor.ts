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
import {
  calcularPrecoFinal,
  faixaPara,
  loadEstruturaCustos,
  loadModelo,
  loadTabelas,
  markupDaMargem,
  parseFaixas,
  round2,
  validarFaixas,
  valorPorFoto,
} from "./pricing.ts";

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

export interface NeedsInputOption { label: string; value: string; hint?: string }

/**
 * Contrato `needs_input` — NÃO é erro: é uma pergunta obrigatória ao usuário.
 * O agente (GPT/Lu) deve perguntar e reenviar a chamada com o campo preenchido.
 * Proibido escolher sozinho ou criar registro novo para "resolver" a pergunta.
 */
function needsInput(input: {
  missing: string[];
  question: string;
  options?: NeedsInputOption[];
  allowCreate?: boolean;
  createHint?: string;
}): McpToolResult {
  const lines = [input.question];
  if (input.options?.length) {
    lines.push(
      ...input.options.map((o) => `- ${o.label}${o.hint ? ` (${o.hint})` : ""} → ${o.value}`),
    );
  }
  if (input.allowCreate && input.createHint) lines.push(input.createHint);
  lines.push(
    `[needs_input] Pergunte ao usuário antes de prosseguir. Campos faltando: ${input.missing.join(", ")}. Não escolha nem crie nada por conta própria.`,
  );
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: {
      status: "needs_input",
      missing: input.missing,
      question: input.question,
      options: input.options ?? [],
      allowCreate: !!input.allowCreate,
    },
  };
}


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

// ---------- helpers de precificação ----------
function somaProdutos(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.reduce((s: number, p: any) => s + (Number(p?.custo) || 0) * (Number(p?.quantidade) || 1), 0);
}
function somaCustos(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.reduce((s: number, c: any) => s + (Number(c?.valorUnitario ?? c?.valor) || 0) * (Number(c?.quantidade) || 1), 0);
}
function arredondar(valor: number, passo: number): number {
  if (!passo || passo <= 0) return round2(valor);
  return round2(Math.ceil(valor / passo) * passo);
}
function resolverMarkup(args: Record<string, any>, margemPadrao: number): { markup: number; origem: string } {
  if (Number(args.markup) > 0) return { markup: Number(args.markup), origem: `markup informado ${Number(args.markup)}x` };
  if (Number(args.margemDesejada) > 0) {
    const m = markupDaMargem(Number(args.margemDesejada));
    if (m) return { markup: m, origem: `derivado da margem ${Number(args.margemDesejada)}%` };
  }
  const padrao = margemPadrao > 0 ? markupDaMargem(margemPadrao) : null;
  if (padrao) return { markup: padrao, origem: `margem configurada ${margemPadrao}%` };
  return { markup: 2, origem: "markup padrão 2x (nenhuma margem configurada)" };
}
async function resolveCategoria(
  sb: SupabaseClient, uid: string, args: Record<string, any>,
): Promise<{ id: string | null; nome?: string; error?: string }> {
  const raw = String(args.categoriaId ?? args.categoria ?? "").trim();
  if (!raw) return { id: null };
  const { data, error } = await sb.from("categorias").select("id,nome").eq("user_id", uid);
  if (error) return { id: null, error: error.message };
  const list = data ?? [];
  const byId = list.find((c: any) => c.id === raw);
  if (byId) return { id: byId.id, nome: byId.nome };
  const alvo = norm(raw);
  const exata = list.find((c: any) => norm(c.nome) === alvo);
  if (exata) return { id: exata.id, nome: exata.nome };
  const parciais = list.filter((c: any) => norm(c.nome).includes(alvo));
  if (parciais.length === 1) return { id: parciais[0].id, nome: parciais[0].nome };
  if (parciais.length > 1) {
    return { id: null, error: `Categoria ambígua: ${parciais.map((c: any) => c.nome).join(", ")}.` };
  }
  return { id: null, error: `Categoria "${raw}" não encontrada. Disponíveis: ${list.map((c: any) => c.nome).join(", ") || "nenhuma"}.` };
}
async function resolvePacote(
  sb: SupabaseClient, uid: string, args: Record<string, any>,
): Promise<{ pacote?: any; error?: string }> {
  const raw = String(args.pacoteId ?? args.pacote ?? "").trim();
  if (!raw) return { error: "Informe o pacote (nome ou id)." };
  const { data, error } = await sb.from("pacotes")
    .select("id,nome,categoria_id,valor_base,valor_foto_extra,fotos_incluidas").eq("user_id", uid);
  if (error) return { error: error.message };
  const list = data ?? [];
  const byId = list.find((p: any) => p.id === raw);
  if (byId) return { pacote: byId };
  const alvo = norm(raw);
  const exato = list.find((p: any) => norm(p.nome) === alvo);
  if (exato) return { pacote: exato };
  const parciais = list.filter((p: any) => norm(p.nome).includes(alvo));
  if (parciais.length === 1) return { pacote: parciais[0] };
  if (parciais.length > 1) return { error: `Pacote ambíguo: ${parciais.map((p: any) => p.nome).join(", ")}.` };
  return { error: `Pacote "${raw}" não encontrado. Disponíveis: ${list.map((p: any) => p.nome).join(", ") || "nenhum"}.` };
}
async function pacoteDuplicado(
  sb: SupabaseClient, uid: string, categoriaId: string, nome: string,
): Promise<string | null> {
  const { data } = await sb.from("pacotes").select("nome").eq("user_id", uid).eq("categoria_id", categoriaId);
  return (data ?? []).some((p: any) => norm(p.nome) === norm(nome))
    ? `Já existe um pacote "${nome}" nessa categoria.` : null;
}
async function upsertTabela(
  sb: SupabaseClient, uid: string, args: Record<string, any>,
  tipo: "global" | "categoria", categoriaId: string | null,
): Promise<McpToolResult> {
  const faixas = parseFaixas(args.faixas);
  const validacao = validarFaixas(faixas);
  if (!validacao.valid) return fail(`Faixas inválidas: ${validacao.errors.join(" ")}`);
  const tabelas = await loadTabelas(sb, uid);
  const atual = tipo === "global"
    ? tabelas.find((t) => t.tipo === "global")
    : tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === categoriaId);
  const payload: Record<string, unknown> = {
    user_id: uid,
    nome: String(args.nome ?? atual?.nome ?? (tipo === "global" ? "Tabela global" : "Tabela da categoria")),
    tipo,
    categoria_id: categoriaId,
    faixas,
    usar_valor_fixo_pacote: args.usarValorFixoPacote !== undefined
      ? Boolean(args.usarValorFixoPacote) : Boolean(atual?.usarValorFixoPacote),
  };
  if (atual) {
    const { error } = await sb.from("tabelas_precos").update(payload).eq("id", atual.id).eq("user_id", uid);
    if (error) return fail(error.message);
  } else {
    const { error } = await sb.from("tabelas_precos").insert(payload);
    if (error) return fail(error.message);
  }
  const amostra = [1, 5, 10, 20].map((q) => `${q}: ${money(valorPorFoto(q, faixas))}/foto`).join(" · ");
  return ok(
    { tipo, categoriaId, faixas, criada: !atual },
    `Tabela ${tipo}${atual ? " atualizada" : " criada"} com ${faixas.length} faixa(s). ${amostra}. Vale para sessões novas.`,
  );
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
): Promise<{ id: string | null; nome: string | null; error?: string; ask?: McpToolResult }> {
  const id = args.clienteId ?? args.cliente_id;
  if (id) {
    const { data } = await sb.from("clientes").select("id,nome").eq("user_id", uid).eq("id", String(id)).maybeSingle();
    if (!data) return { id: null, nome: null, error: `Cliente ${id} não encontrado.` };
    return { id: data.id, nome: data.nome };
  }
  const nome = args.clienteNome ?? args.client ?? args.cliente;
  if (!nome) return { id: null, nome: null };
  const { data } = await sb.from("clientes").select("id,nome,telefone,email").eq("user_id", uid).limit(500);
  const alvo = norm(nome);
  const hits = (data ?? []).filter((c: any) => norm(c.nome).includes(alvo) || alvo.includes(norm(c.nome)));
  if (hits.length === 0) {
    return {
      id: null,
      nome: String(nome),
      ask: needsInput({
        missing: ["clienteId"],
        question: `Não encontrei nenhum cliente parecido com "${nome}". Qual é o cliente correto?`,
        allowCreate: true,
        createHint: "Se for cliente novo, confirme com o usuário e crie com lunari.clientes.create antes de continuar.",
      }),
    };
  }
  if (hits.length > 1) {
    return {
      id: null,
      nome: String(nome),
      ask: needsInput({
        missing: ["clienteId"],
        question: `Há ${hits.length} clientes parecidos com "${nome}". Qual deles?`,
        options: hits.slice(0, 8).map((c: any) => ({
          label: c.nome,
          value: c.id,
          hint: c.telefone || c.email || undefined,
        })),
      }),
    };
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

// -------------------- Workflow: helpers --------------------

const SESSAO_COLS =
  "id,session_id,cliente_id,appointment_id,galeria_id,data_sessao,hora_sessao,categoria,pacote," +
  "descricao,observacoes,detalhes,status,status_financeiro,valor_total,valor_pago,valor_base_pacote," +
  "valor_adicional,desconto,qtd_fotos_extra,valor_foto_extra,valor_total_foto_extra,produtos_incluidos," +
  "clientes(id,nome,telefone,email)";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve uma sessão a partir de `sessionId` (UUID), `session_id` texto
 * (workflow-*) ou do nome do cliente (fuzzy, igual aos demais resolvers).
 */
async function resolveSessao(
  sb: SupabaseClient,
  uid: string,
  args: Record<string, any>,
): Promise<{ sessao: any | null; error?: string }> {
  const key = String(args.sessionId ?? args.session_id ?? args.id ?? "").trim();
  if (key) {
    if (UUID_RE.test(key)) {
      const { data } = await sb.from("clientes_sessoes").select(SESSAO_COLS)
        .eq("user_id", uid).eq("id", key).maybeSingle();
      if (data) return { sessao: data };
    }
    const { data } = await sb.from("clientes_sessoes").select(SESSAO_COLS)
      .eq("user_id", uid).eq("session_id", key).maybeSingle();
    if (data) return { sessao: data };
    return { sessao: null, error: `Sessão "${key}" não encontrada.` };
  }

  const cli = await resolveCliente(sb, uid, args);
  if (cli.error) return { sessao: null, error: cli.error };
  if (!cli.id) {
    return { sessao: null, error: "Informe 'sessionId' ou 'clienteNome' para identificar a sessão." };
  }
  const { data } = await sb.from("clientes_sessoes").select(SESSAO_COLS)
    .eq("user_id", uid).eq("cliente_id", cli.id)
    .order("data_sessao", { ascending: false }).limit(10);
  const list = data ?? [];
  if (list.length === 0) return { sessao: null, error: `Nenhuma sessão para "${cli.nome}".` };
  if (list.length > 1 && !args.latest) {
    return {
      sessao: null,
      error:
        `"${cli.nome}" tem ${list.length} sessões: ` +
        list.map((s: any) => `${s.data_sessao ?? "sem data"} (${s.pacote ?? s.categoria ?? "—"}) id=${s.id}`).join("; ") +
        ". Informe sessionId ou latest=true.",
    };
  }
  return { sessao: list[0] };
}

/** Janela do mês a partir de `year`/`month` (padrão: mês corrente). */
function monthRange(args: Record<string, any>): { start: string; end: string } {
  const now = new Date();
  const year = Number(args.year) || now.getUTCFullYear();
  const month = Number(args.month) || now.getUTCMonth() + 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const end = addDays(`${nextY}-${String(nextM).padStart(2, "0")}-01`, -1);
  return { start, end };
}

/** Projeção somente-leitura de `produtos_incluidos` (JSONB da sessão). */
function projetarProdutos(sessao: any) {
  const raw = Array.isArray(sessao?.produtos_incluidos) ? sessao.produtos_incluidos : [];
  return raw.map((p: any, idx: number) => {
    const etapas = Array.isArray(p?.etapas) ? p.etapas : [];
    const feitas = etapas.filter((e: any) => e?.done).length;
    const atual = etapas.find((e: any) => !e?.done);
    return {
      id: p?.id ?? p?.produtoId ?? `idx-${idx}`,
      nome: p?.nome ?? "Produto",
      quantidade: Number(p?.quantidade) || 0,
      valorUnitario: Number(p?.valorUnitario) || 0,
      valorTotal: (Number(p?.quantidade) || 0) * (Number(p?.valorUnitario) || 0),
      tipo: p?.tipo ?? "manual",
      fluxo: p?.fluxo ?? "padrao",
      prazoEntrega: p?.prazoEntrega ?? null,
      etapaAtual: atual?.nome ?? (etapas.length ? "concluído" : null),
      etapasConcluidas: feitas,
      etapasTotal: etapas.length,
      entregue: Boolean(p?.entregue) || (etapas.length > 0 && feitas === etapas.length),
    };
  });
}



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
  "lunari.workflow.getCardBySession": async (sb, uid, args) => {
    const r = await resolveSessao(sb, uid, args);
    if (r.error) return fail(r.error);
    const s = r.sessao!;
    const [{ data: fin }, { data: gal }] = await Promise.all([
      sb.rpc("workflow_session_financials", { p_session_id: s.id }),
      s.galeria_id
        ? sb.from("galerias").select("id,titulo,status,status_pagamento").eq("id", s.galeria_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    const produtos = Array.isArray(s.produtos_incluidos) ? s.produtos_incluidos : [];
    return ok(
      {
        sessao: s,
        cliente: s.clientes ?? null,
        galeria: gal ?? null,
        financeiro: Array.isArray(fin) ? fin[0] ?? null : fin ?? null,
        produtos,
      },
      `Sessão ${s.session_id ?? s.id} · ${s.clientes?.nome ?? "sem cliente"} · ${s.data_sessao ?? "sem data"} · ` +
        `${s.status ?? "sem etapa"} · total ${money(s.valor_total)} · pago ${money(s.valor_pago)} · ` +
        `pendente ${money((Number(s.valor_total) || 0) - (Number(s.valor_pago) || 0))}.`,
    );
  },
  "lunari.workflow.getSessionFinancials": async (sb, uid, args) => {
    const r = await resolveSessao(sb, uid, args);
    if (r.error) return fail(r.error);
    const s = r.sessao!;
    const { data, error } = await sb.rpc("workflow_session_financials", { p_session_id: s.id });
    if (error) return fail(error.message);
    const fin = Array.isArray(data) ? data[0] ?? null : data ?? null;
    const { data: pagamentos } = await sb.from("clientes_transacoes")
      .select("id,valor,tipo,data_transacao,descricao")
      .eq("user_id", uid).eq("session_id", s.session_id ?? "__none__")
      .order("data_transacao", { ascending: false }).limit(100);
    return ok(
      { sessionId: s.id, sessionKey: s.session_id, financeiro: fin, pagamentos: pagamentos ?? [] },
      `Total ${money(s.valor_total)} · pago ${money(s.valor_pago)} · pendente ${money((Number(s.valor_total) || 0) - (Number(s.valor_pago) || 0))} · ${pagamentos?.length ?? 0} lançamento(s).`,
    );
  },
  "lunari.workflow.listSessionsByPaymentStatus": async (sb, uid, args) => {
    const status = String(args.statusFinanceiro ?? args.status ?? "pendente");
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,cliente_id,data_sessao,pacote,status,valor_total,valor_pago,status_financeiro")
      .eq("user_id", uid).eq("status_financeiro", status)
      .order("data_sessao", { ascending: false }).limit(clampLimit(args.limit, 50, 200));
    if (error) return fail(error.message);
    return ok({ statusFinanceiro: status, sessoes: data ?? [] }, `${data?.length ?? 0} sessão(ões) com status financeiro "${status}".`);
  },
  "lunari.workflow.statusOptions": async (sb, uid) => {
    const { data, error } = await sb.from("etapas_trabalho")
      .select("nome,cor,ordem").eq("user_id", uid).order("ordem");
    if (error) return fail(error.message);
    const options = (data ?? []).map((r: any) => ({ value: r.nome, label: r.nome, color: r.cor ?? null, ordem: r.ordem ?? null }));
    return ok({ options }, options.length ? `Etapas: ${options.map((o: any) => o.value).join(" → ")}.` : "Nenhuma etapa configurada.");
  },
  "lunari.workflow.metricsForMonth": async (sb, uid, args) => {
    const { start, end } = monthRange(args);
    const { data, error } = await sb.rpc("workflow_month_metrics", { p_user_id: uid, p_start: start, p_end: end });
    if (error) return fail(error.message);
    const m = (Array.isArray(data) ? data[0] : data) ?? {};
    return ok(
      { start, end, metrics: m },
      `${start.slice(0, 7)}: ${m.sessoes ?? 0} sessão(ões) · previsto ${money(m.previsto)} · recebido ${money(m.receita)} · pendente ${money(m.pendente)}.`,
    );
  },
  "lunari.workflow.metricsForRange": async (sb, uid, args) => {
    const start = String(args.start ?? args.startDate ?? addDays(today(), -90));
    const end = String(args.end ?? args.endDate ?? today());
    const { data, error } = await sb.rpc("workflow_range_metrics", {
      p_user_id: uid, p_start: start, p_end: end,
      p_granularity: String(args.granularity ?? "month"),
      p_include_historico: Boolean(args.includeHistorico ?? false),
    });
    if (error) return fail(error.message);
    return ok({ start, end, metrics: data }, `Métricas de ${start} a ${end} calculadas.`);
  },
  "lunari.workflow.analytics.summary": async (sb, uid, args) => {
    const start = String(args.start ?? args.startDate ?? addDays(today(), -365));
    const end = String(args.end ?? args.endDate ?? today());
    const { data, error } = await sb.rpc("workflow_analytics_summary", {
      p_user_id: uid, p_start: start, p_end: end,
      p_include_historico: Boolean(args.includeHistorico ?? false),
    });
    if (error) return fail(error.message);
    const t = (data as any)?.totals ?? {};
    return ok(
      { start, end, summary: data },
      `${t.sessoes ?? 0} sessão(ões) de ${start} a ${end} · previsto ${money(t.previsto)} · receita ${money(t.receita)} · ticket médio ${money(t.ticket_medio)}.`,
    );
  },
  "lunari.workflow.photoProductionForMonth": async (sb, uid, args) => {
    const { start, end } = monthRange(args);
    const { data, error } = await sb.rpc("workflow_photo_production_month", {
      p_user_id: uid, p_start: start, p_end: end,
      p_categoria: args.categoria ? String(args.categoria) : null,
    });
    if (error) return fail(error.message);
    const row = (Array.isArray(data) ? data[0] : data) ?? {};
    return ok({ start, end, producao: data }, `Produção fotográfica de ${start.slice(0, 7)}: ${JSON.stringify(row).slice(0, 300)}`);
  },
  "lunari.workflow.photoProductionForYear": async (sb, uid, args) => {
    const year = Number(args.year ?? args.ano ?? new Date().getFullYear());
    const categoria = args.categoria ? String(args.categoria) : null;
    const n = (v: unknown) => Number(v) || 0;
    const porMes: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
      const { data, error } = await sb.rpc("workflow_photo_production_month", {
        p_user_id: uid, p_start: `${year}-${mm}-01`, p_end: `${year}-${mm}-${String(last).padStart(2, "0")}`,
        p_categoria: categoria,
      });
      if (error) return fail(error.message);
      const r: any = (Array.isArray(data) ? data[0] : data) ?? {};
      porMes.push({
        mes: m,
        fotosIncluidas: Math.round(n(r.fotos_incluidas)),
        fotosExtras: Math.round(n(r.fotos_extras)),
        fotosTotal: Math.round(n(r.fotos_total)),
        sessoes: Math.round(n(r.sessoes_com_pacote)) + Math.round(n(r.sessoes_sem_pacote)),
        categoriaTop: r.categoria_top ?? null,
        fotosCategoriaTop: Math.round(n(r.fotos_categoria_top)),
      });
    }
    const sum = (k: string) => porMes.reduce((a, x) => a + (Number(x[k]) || 0), 0);
    const catMap = new Map<string, number>();
    for (const m of porMes) if (m.categoriaTop) catMap.set(m.categoriaTop, (catMap.get(m.categoriaTop) ?? 0) + m.fotosCategoriaTop);
    const top = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const sessoes = sum("sessoes");
    const total = {
      fotosIncluidas: sum("fotosIncluidas"), fotosExtras: sum("fotosExtras"), fotosTotal: sum("fotosTotal"),
      sessoes, mediaFotosPorSessao: sessoes > 0 ? Number((sum("fotosTotal") / sessoes).toFixed(2)) : 0,
      categoriaTop: top?.[0] ?? null, fotosCategoriaTop: top?.[1] ?? 0,
    };
    return ok(
      { year, total, porMes },
      `${year}: ${total.fotosTotal} foto(s) em ${sessoes} sessão(ões) · ${total.fotosIncluidas} inclusas + ${total.fotosExtras} extras · média ${total.mediaFotosPorSessao}/sessão${total.categoriaTop ? ` · categoria líder ${total.categoriaTop}` : ""}.`,
    );
  },

  // -------------------- ANÁLISE DE VENDAS --------------------
  "lunari.workflow.vendas.resumo": async (sb, uid, args) => {
    const ano = Number(args.ano ?? args.year ?? new Date().getFullYear());
    const mes = args.mes != null ? Number(args.mes) : (args.month != null ? Number(args.month) : null);
    const categoria = args.categoria ? String(args.categoria) : null;
    const { data, error } = await sb.rpc("sales_analytics_summary", {
      p_user_id: uid, p_year: ano, p_month: mes, p_categoria: categoria,
    });
    if (error) return fail(error.message);
    const t = (data as any)?.totais ?? {};
    const periodo = mes ? `${ano}-${String(mes).padStart(2, "0")}` : String(ano);
    return ok(
      { periodo, resumo: data },
      `${periodo}: ${t.sessoes ?? 0} sessão(ões) · receita ${money(t.receita_realizada)} de ${money(t.receita_prevista)} previstos · pendente ${money(t.pendente)} · ticket médio ${money(t.ticket_medio)} · fotos extras ${money(t.receita_fotos_extras)} · desconto ${money(t.desconto_total)} · ${t.clientes_unicos ?? 0} cliente(s).`,
    );
  },
  "lunari.workflow.vendas.compararAnos": async (sb, uid, args) => {
    const anoBase = Number(args.anoBase ?? new Date().getFullYear());
    const anoComparacao = Number(args.anoComparacao ?? anoBase - 1);
    const { data, error } = await sb.rpc("sales_analytics_compare", {
      p_user_id: uid, p_ano_base: anoBase, p_ano_comparacao: anoComparacao,
      p_limite_mes: args.limiteMes != null ? Number(args.limiteMes) : null,
      p_categoria: args.categoria ? String(args.categoria) : null,
    });
    if (error) return fail(error.message);
    const d = data as any;
    const v = d?.variacaoPercentual ?? {};
    return ok(
      { comparativo: data },
      `${anoBase} vs ${anoComparacao} (até o mês ${d?.limiteMes}): receita ${money(d?.base?.receita)} vs ${money(d?.comparacao?.receita)} (${v.receita ?? "—"}%) · sessões ${d?.base?.sessoes ?? 0} vs ${d?.comparacao?.sessoes ?? 0} (${v.sessoes ?? "—"}%) · ticket médio ${money(d?.base?.ticket_medio)} vs ${money(d?.comparacao?.ticket_medio)} (${v.ticketMedio ?? "—"}%).`,
    );
  },
  "lunari.workflow.vendas.metasProgresso": async (sb, uid, args) => {
    const ano = Number(args.ano ?? new Date().getFullYear());
    const mesRef = args.mes != null ? Number(args.mes) : new Date().getUTCMonth() + 1;
    const [resumoRes, cfgRes, metasRes] = await Promise.all([
      sb.rpc("sales_analytics_summary", { p_user_id: uid, p_year: ano, p_month: null, p_categoria: null }),
      sb.from("pricing_configuracoes").select("meta_faturamento_anual,ano_meta,modo_metas").eq("user_id", uid).maybeSingle(),
      sb.from("metas_personalizadas").select("mes,categoria,meta_faturamento").eq("user_id", uid).eq("ano", ano),
    ]);
    if (resumoRes.error) return fail(resumoRes.error.message);
    const resumo: any = resumoRes.data ?? {};
    const num = (v: unknown) => Number(v) || 0;
    const metas: any[] = (metasRes.data as any[]) ?? [];
    const metaAnualPers = metas.find((m) => !m.mes && !m.categoria)?.meta_faturamento;
    const metaAnual = num(metaAnualPers ?? (cfgRes.data as any)?.meta_faturamento_anual);
    const realizadoAno = num(resumo?.totais?.receita_realizada);
    const realizadoMes = num((resumo?.porMes ?? []).find((m: any) => Number(m.mes) === mesRef)?.receita);
    const metaMes = num(metas.find((m) => Number(m.mes) === mesRef && !m.categoria)?.meta_faturamento ?? (metaAnual > 0 ? metaAnual / 12 : 0));
    const mesesRestantes = Math.max(12 - mesRef + 1, 1);
    const gap = Math.max(metaAnual - realizadoAno, 0);
    const porCategoria = metas.filter((m) => !!m.categoria).map((m) => {
      const meta = num(m.meta_faturamento);
      const realizado = num((resumo?.porCategoria ?? []).find((c: any) => String(c.categoria).toLowerCase() === String(m.categoria).toLowerCase())?.receita);
      return { categoria: m.categoria, meta, realizado, progressoPercentual: meta > 0 ? Number(((realizado / meta) * 100).toFixed(2)) : null, falta: Math.max(meta - realizado, 0) };
    });
    const pct = metaAnual > 0 ? Number(((realizadoAno / metaAnual) * 100).toFixed(1)) : null;
    return ok(
      {
        ano,
        anual: { meta: metaAnual, realizado: realizadoAno, progressoPercentual: pct, falta: gap, ritmoMensalNecessario: Number((gap / mesesRestantes).toFixed(2)), mesesRestantes, origem: metaAnualPers != null ? "metas_personalizadas" : "precificacao" },
        mensal: { mes: mesRef, meta: metaMes, realizado: realizadoMes, progressoPercentual: metaMes > 0 ? Number(((realizadoMes / metaMes) * 100).toFixed(1)) : null, falta: Math.max(metaMes - realizadoMes, 0) },
        porCategoria,
      },
      metaAnual > 0
        ? `Meta anual ${money(metaAnual)} · realizado ${money(realizadoAno)} (${pct}%) · faltam ${money(gap)} em ${mesesRestantes} mês(es) → ${money(gap / mesesRestantes)}/mês. Mês ${mesRef}: ${money(realizadoMes)} de ${money(metaMes)}.`
        : `Nenhuma meta anual configurada para ${ano}. Realizado: ${money(realizadoAno)}.`,
    );
  },

  // -------------------- LEADS (leitura) --------------------
  "lunari.leads.listStatuses": async (sb, uid) => {
    const { data, error } = await sb.from("lead_statuses")
      .select("key,name,sort_order,color,is_converted,is_lost").eq("user_id", uid).order("sort_order");
    if (error) return fail(error.message);
    return ok({ statuses: data ?? [] }, (data ?? []).map((s: any) => s.name).join(" → ") || "Nenhum estágio configurado.");
  },
  "lunari.leads.get": async (sb, uid, args) => {
    const id = String(args.id ?? "");
    let q = sb.from("leads").select("*").eq("user_id", uid).limit(1);
    q = UUID_RE.test(id) ? q.eq("id", id) : q.ilike("nome", `%${id}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    const lead = (data ?? [])[0];
    if (!lead) return fail(`Lead não encontrado: ${id}`);
    return ok({ lead }, `${lead.nome} · ${lead.status ?? "sem estágio"} · origem ${lead.origem ?? "—"}${lead.motivo_perda ? ` · perdido: ${lead.motivo_perda}` : ""}.`);
  },
  "lunari.leads.list": async (sb, uid, args) => {
    let q = sb.from("leads")
      .select("id,nome,email,telefone,origem,status,motivo_perda,created_at,data_contato,arquivado,cliente_id")
      .eq("user_id", uid).order("created_at", { ascending: false }).limit(clampLimit(args.limit, 50, 200));
    const arq = String(args.arquivados ?? "ocultar");
    if (arq === "ocultar") q = q.or("arquivado.is.null,arquivado.eq.false");
    else if (arq === "somente") q = q.eq("arquivado", true);
    if (args.status) q = q.eq("status", String(args.status));
    if (args.origem) q = q.eq("origem", String(args.origem));
    if (args.desde) q = q.gte("created_at", String(args.desde));
    if (args.ate) q = q.lte("created_at", `${String(args.ate)}T23:59:59.999Z`);
    if (args.search) q = q.ilike("nome", `%${String(args.search)}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ leads: data ?? [] }, `${data?.length ?? 0} lead(s).`);
  },
  "lunari.leads.metrics": async (sb, uid, args) => {
    const now = new Date();
    const desde = String(args.desde ?? `${now.getUTCFullYear()}-01-01`);
    const ate = String(args.ate ?? today());
    const [{ data: statuses, error: sErr }, { data: rows, error: lErr }] = await Promise.all([
      sb.from("lead_statuses").select("key,name,is_converted,is_lost").eq("user_id", uid),
      sb.from("leads").select("status,origem,motivo_perda,cliente_id")
        .eq("user_id", uid).gte("created_at", desde).lte("created_at", `${ate}T23:59:59.999Z`).limit(5000),
    ]);
    if (sErr) return fail(sErr.message);
    if (lErr) return fail(lErr.message);
    const conv = new Set((statuses ?? []).filter((s: any) => s.is_converted).map((s: any) => s.key));
    const lost = new Set((statuses ?? []).filter((s: any) => s.is_lost).map((s: any) => s.key));
    const porStatus: Record<string, number> = {}, porOrigem: Record<string, number> = {}, motivos: Record<string, number> = {};
    let convertidos = 0, perdidos = 0;
    for (const l of ((rows ?? []) as any[])) {
      const st = l.status ?? "sem-status";
      porStatus[st] = (porStatus[st] ?? 0) + 1;
      const og = l.origem || "nao-especificado";
      porOrigem[og] = (porOrigem[og] ?? 0) + 1;
      if (conv.has(st) || l.cliente_id) convertidos++;
      if (lost.has(st)) { perdidos++; const mp = l.motivo_perda || "não informado"; motivos[mp] = (motivos[mp] ?? 0) + 1; }
    }
    const total = rows?.length ?? 0;
    const taxa = total > 0 ? Number(((convertidos / total) * 100).toFixed(1)) : 0;
    const topMotivo = Object.entries(motivos).sort((a, b) => b[1] - a[1])[0] ?? null;
    return ok(
      { periodo: { desde, ate }, total, porStatus, porOrigem, convertidos, perdidos, motivosPerda: motivos, taxaConversao: taxa },
      `${total} lead(s) de ${desde} a ${ate} · ${convertidos} convertido(s) (${taxa}%) · ${perdidos} perdido(s)${topMotivo ? ` · principal motivo: ${topMotivo[0]} (${topMotivo[1]})` : ""}.`,
    );
  },
  "lunari.workflow.diagnoseSession": async (sb, uid, args) => {
    const r = await resolveSessao(sb, uid, args);
    if (r.error) return fail(r.error);
    const s = r.sessao!;
    const findings: Array<{ code: string; severity: string; message: string; suggestedCapability: string | null }> = [];
    const total = Number(s.valor_total) || 0, pago = Number(s.valor_pago) || 0;
    if (!s.cliente_id) findings.push({ code: "SEM_CLIENTE", severity: "warning", message: "Sessão sem cliente vinculado.", suggestedCapability: "lunari.workflow.updateFields" });
    if (!s.data_sessao) findings.push({ code: "SEM_DATA", severity: "warning", message: "Sessão sem data.", suggestedCapability: "lunari.workflow.updateFields" });
    if (total <= 0) findings.push({ code: "TOTAL_ZERADO", severity: "warning", message: "Valor total zerado.", suggestedCapability: "lunari.workflow.updateFields" });
    if (pago > total + 0.009) findings.push({ code: "PAGO_MAIOR_TOTAL", severity: "critical", message: `Pago (${money(pago)}) maior que o total (${money(total)}).`, suggestedCapability: "lunari.workflow.getSessionFinancials" });
    if (!s.galeria_id) findings.push({ code: "SEM_GALERIA", severity: "info", message: "Sessão sem galeria vinculada.", suggestedCapability: null });
    const produtos = Array.isArray(s.produtos_incluidos) ? s.produtos_incluidos : [];
    for (const p of produtos as any[]) {
      if (p?.tipo === "manual" && !(Number(p.valorUnitario) > 0)) {
        findings.push({ code: "PRODUTO_SEM_PRECO", severity: "warning", message: `Produto "${p?.nome ?? "?"}" sem preço unitário.`, suggestedCapability: "lunari.workflow.produto.setPrice" });
      }
    }
    return ok(
      { sessionId: s.id, ok: findings.length === 0, findings },
      findings.length === 0 ? "Nenhuma inconsistência encontrada." : `${findings.length} ponto(s) de atenção: ${findings.map((f) => f.message).join(" ")}`,
    );
  },
  "lunari.workflow.produto.listBySession": async (sb, uid, args) => {
    const r = await resolveSessao(sb, uid, args);
    if (r.error) return fail(r.error);
    const produtos = projetarProdutos(r.sessao!);
    return ok(
      { sessionId: r.sessao!.id, produtos },
      produtos.length
        ? produtos.map((p: any) => `${p.nome} ×${p.quantidade} · ${p.etapaAtual ?? "sem etapa"}${p.prazoEntrega ? ` · prazo ${p.prazoEntrega}` : ""}`).join(" | ")
        : "Nenhum produto nesta sessão.",
    );
  },
  "lunari.workflow.produto.listPending": async (sb, uid, args) => {
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,data_sessao,produtos_incluidos,clientes(nome)")
      .eq("user_id", uid).neq("status", "historico")
      .not("produtos_incluidos", "is", null)
      .order("data_sessao", { ascending: false }).limit(clampLimit(args.limit, 200, 400));
    if (error) return fail(error.message);
    const hoje = today();
    const buckets: Record<string, any[]> = { atrasado: [], hoje: [], amanha: [], semana: [], futuro: [], semPrazo: [] };
    for (const s of (data ?? []) as any[]) {
      for (const p of projetarProdutos(s)) {
        if (p.entregue) continue;
        const item = { sessionId: s.id, sessionKey: s.session_id, cliente: s.clientes?.nome ?? null, ...p };
        const prazo = p.prazoEntrega;
        if (!prazo) buckets.semPrazo.push(item);
        else if (prazo < hoje) buckets.atrasado.push(item);
        else if (prazo === hoje) buckets.hoje.push(item);
        else if (prazo === addDays(hoje, 1)) buckets.amanha.push(item);
        else if (prazo <= addDays(hoje, 7)) buckets.semana.push(item);
        else buckets.futuro.push(item);
      }
    }
    const totalPend = Object.values(buckets).reduce((a, b) => a + b.length, 0);
    return ok(
      { buckets, total: totalPend },
      `${totalPend} produto(s) em produção · ${buckets.atrasado.length} atrasado(s), ${buckets.hoje.length} para hoje, ${buckets.semana.length} nesta semana.`,
    );
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

  // ---------- PRECIFICAÇÃO (leitura e simulação) ----------
  "lunari.precificacao.getConfiguracao": async (sb, uid) => {
    const [modelo, tabelas, estrutura] = await Promise.all([
      loadModelo(sb, uid), loadTabelas(sb, uid), loadEstruturaCustos(sb, uid),
    ]);
    return ok(
      {
        modelo,
        hasTabelaGlobal: tabelas.some((t) => t.tipo === "global"),
        categoriasComTabela: tabelas.filter((t) => t.tipo === "categoria").length,
        horasDisponiveisDia: estrutura.horasDisponiveisDia,
        diasTrabalhadosSemana: estrutura.diasTrabalhadosSemana,
        horasMes: estrutura.horasMes,
        percentualProLabore: estrutura.percentualProLabore,
        margemLucroDesejada: estrutura.margemLucroDesejada,
        custoPorHora: estrutura.custoPorHora,
      },
      `Modelo "${modelo}" · ${estrutura.horasMes}h produtivas/mês · custo/hora ${money(estrutura.custoPorHora)} · margem desejada ${estrutura.margemLucroDesejada}%.`,
    );
  },
  "lunari.precificacao.getEstruturaCustos": async (sb, uid) => {
    const e = await loadEstruturaCustos(sb, uid);
    return ok(
      e,
      `Custo fixo ${money(e.custoFixoMensal)}/mês (pessoais ${money(e.totalGastosPessoais)} + estúdio ${money(e.totalCustosEstudio)} + depreciação ${money(e.totalDepreciacaoMensal)}) · ${e.horasMes}h/mês · custo/hora ${money(e.custoPorHora)}.`,
    );
  },
  "lunari.precificacao.listTabelas": async (sb, uid) => {
    const [modelo, items] = await Promise.all([loadModelo(sb, uid), loadTabelas(sb, uid)]);
    return ok({ modelo, items }, `Modelo "${modelo}" · ${items.length} tabela(s) configurada(s).`);
  },
  "lunari.precificacao.getTabelaCategoria": async (sb, uid, args) => {
    const cat = await resolveCategoria(sb, uid, args);
    if (cat.error) return fail(cat.error);
    if (!cat.id) return fail("Informe a categoria.");
    const tabelas = await loadTabelas(sb, uid);
    const t = tabelas.find((x) => x.tipo === "categoria" && x.categoriaId === cat.id) ?? null;
    return ok(
      { categoria: cat.nome, tabela: t },
      t ? `Tabela "${t.nome}" com ${t.faixas.length} faixa(s).` : `${cat.nome} não tem tabela própria.`,
    );
  },
  "lunari.precificacao.listPacotesComPreco": async (sb, uid, args) => {
    const cat = await resolveCategoria(sb, uid, args);
    if (cat.error) return fail(cat.error);
    let q = sb.from("pacotes")
      .select("id,nome,categoria_id,valor_base,valor_foto_extra,fotos_incluidas")
      .eq("user_id", uid).order("nome");
    if (cat.id) q = q.eq("categoria_id", cat.id);
    const { data, error } = await q;
    if (error) return fail(error.message);
    const items = data ?? [];
    return ok(
      { categoria: cat.nome ?? null, items },
      items.length
        ? items.map((p: any) => `${p.nome}: base ${money(p.valor_base)} · extra ${money(p.valor_foto_extra)} · ${p.fotos_incluidas} inclusa(s)`).join(" | ")
        : "Nenhum pacote cadastrado.",
    );
  },
  "lunari.precificacao.getMetas": async (sb, uid, args) => {
    const { data: cfg } = await sb.from("pricing_configuracoes")
      .select("margem_lucro_desejada, ano_meta, meta_faturamento_anual, meta_lucro_anual, usar_metas_personalizadas")
      .eq("user_id", uid).maybeSingle();
    let q = sb.from("metas_personalizadas")
      .select("ano,mes,categoria,meta_faturamento,meta_lucro").eq("user_id", uid).order("ano").order("mes");
    if (args.ano) q = q.eq("ano", Math.floor(Number(args.ano)));
    const { data: metas, error } = await q;
    if (error) return fail(error.message);
    return ok(
      {
        margemLucroDesejada: Number(cfg?.margem_lucro_desejada ?? 0),
        anoMeta: cfg?.ano_meta ?? null,
        metaFaturamentoAnual: Number(cfg?.meta_faturamento_anual ?? 0),
        metaLucroAnual: Number(cfg?.meta_lucro_anual ?? 0),
        usarMetasPersonalizadas: Boolean(cfg?.usar_metas_personalizadas),
        personalizadas: metas ?? [],
      },
      `Meta ${cfg?.ano_meta ?? "—"}: faturamento ${money(cfg?.meta_faturamento_anual)} · lucro ${money(cfg?.meta_lucro_anual)} · margem ${Number(cfg?.margem_lucro_desejada ?? 0)}%.`,
    );
  },
  "lunari.precificacao.listCenarios": async (sb, uid, args) => {
    const { data, error } = await sb.from("pricing_calculadora_estados")
      .select("id,nome,horas_estimadas,markup,custo_total_calculado,preco_final_calculado,lucratividade,is_default,updated_at")
      .eq("user_id", uid).order("updated_at", { ascending: false }).limit(clampLimit(args.limit, 20, 50));
    if (error) return fail(error.message);
    return ok({ items: data ?? [] }, `${data?.length ?? 0} cenário(s) salvo(s).`);
  },
  "lunari.precificacao.diagnostico": async (sb, uid) => {
    const [modelo, tabelas, estrutura] = await Promise.all([
      loadModelo(sb, uid), loadTabelas(sb, uid), loadEstruturaCustos(sb, uid),
    ]);
    const problemas: string[] = [], avisos: string[] = [];
    if (estrutura.custoFixoMensal <= 0) problemas.push("Nenhum custo fixo cadastrado — o custo por hora fica zerado.");
    if (estrutura.horasMes <= 0) problemas.push("Horas produtivas não configuradas.");
    if (estrutura.margemLucroDesejada <= 0) avisos.push("Margem de lucro desejada não definida.");
    if (modelo === "global" && !tabelas.some((t) => t.tipo === "global")) problemas.push("Modelo é 'tabela global', mas nenhuma tabela global foi criada.");
    if (modelo === "categoria" && tabelas.filter((t) => t.tipo === "categoria").length === 0) problemas.push("Modelo é 'por categoria', mas nenhuma categoria tem tabela.");
    const { data: pacotes } = await sb.from("pacotes").select("nome,valor_base,valor_foto_extra").eq("user_id", uid);
    const semBase = (pacotes ?? []).filter((p: any) => !(Number(p.valor_base) > 0));
    if (semBase.length) avisos.push(`${semBase.length} pacote(s) sem valor base definido.`);
    if (modelo === "fixo") {
      const semExtra = (pacotes ?? []).filter((p: any) => !(Number(p.valor_foto_extra) > 0));
      if (semExtra.length) avisos.push(`${semExtra.length} pacote(s) sem valor de foto extra.`);
    }
    return ok(
      { pronto: problemas.length === 0, problemas, avisos },
      problemas.length ? `Pendências: ${problemas.join(" ")}` : `Precificação pronta.${avisos.length ? ` Avisos: ${avisos.join(" ")}` : ""}`,
    );
  },
  "lunari.precificacao.simularPreco": async (sb, uid, args) => {
    const horas = Number(args.horasEstimadas ?? 0) || 0;
    if (horas <= 0) return fail("Informe 'horasEstimadas' maior que zero.");
    const estrutura = await loadEstruturaCustos(sb, uid);
    const custoPorHora = Number(args.custoPorHoraOverride ?? estrutura.custoPorHora) || 0;
    const { markup, origem } = resolverMarkup(args, estrutura.margemLucroDesejada);
    const notas: string[] = [`Markup ${markup}x (${origem}).`];
    if (custoPorHora <= 0) notas.push("Custo por hora zerado — cadastre custos fixos e horas produtivas.");
    const r = calcularPrecoFinal({
      horasEstimadas: horas, custoPorHora, markup,
      custoProdutos: somaProdutos(args.produtos), custosAdicionais: somaCustos(args.custosExtras),
    });
    if (estrutura.margemLucroDesejada > 0 && r.lucratividade < estrutura.margemLucroDesejada) {
      notas.push(`Lucratividade ${r.lucratividade}% abaixo da margem desejada (${estrutura.margemLucroDesejada}%).`);
    }
    return ok(
      { custoPorHora: round2(custoPorHora), markupUsado: markup, origemMarkup: origem, ...r, notas },
      `Custo/hora ${money(custoPorHora)} · custo total ${money(r.custoTotal)} · preço sugerido ${money(r.precoFinal)} · lucratividade ${r.lucratividade}% (${origem}).`,
    );
  },
  "lunari.precificacao.simularFotoExtra": async (sb, uid, args) => {
    const quantidade = Math.floor(Number(args.quantidade ?? 0) || 0);
    if (quantidade <= 0) return fail("Informe 'quantidade' maior que zero.");
    const modelo = await loadModelo(sb, uid);
    const notas: string[] = [];
    let pacote: any = null;
    if (args.pacote || args.pacoteId) {
      const p = await resolvePacote(sb, uid, args);
      if (p.error) return fail(p.error);
      pacote = p.pacote;
    }
    const cat = await resolveCategoria(sb, uid, args);
    const catId = cat.id ?? pacote?.categoria_id ?? null;

    const finalize = (unit: number, faixa: unknown, tabelaNome: string | null) =>
      ok(
        { modelo, quantidade, valorUnitario: round2(unit), valorTotal: round2(unit * quantidade), faixaAplicada: faixa, tabelaUsada: tabelaNome, notas },
        `${quantidade} foto(s) extra: ${money(unit)}/foto · total ${money(unit * quantidade)}${tabelaNome ? ` (tabela ${tabelaNome})` : ""}.`,
      );

    if (modelo === "fixo") {
      if (!pacote) notas.push("Modelo fixo usa o valor do pacote — informe o pacote para um valor real.");
      return finalize(Number(pacote?.valor_foto_extra ?? 0) || 0, null, null);
    }
    const tabelas = await loadTabelas(sb, uid);
    const tabela = modelo === "global"
      ? tabelas.find((t) => t.tipo === "global") ?? null
      : tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === catId) ?? null;
    if (!tabela) {
      notas.push(modelo === "global"
        ? "Nenhuma tabela global configurada — extras ficariam zerados."
        : "Esta categoria não tem tabela configurada — extras ficariam zerados.");
      return finalize(0, null, null);
    }
    if (tabela.usarValorFixoPacote) {
      notas.push("Tabela marcada para usar o valor fixo do pacote.");
      return finalize(Number(pacote?.valor_foto_extra ?? 0) || 0, null, tabela.nome);
    }
    return finalize(valorPorFoto(quantidade, tabela.faixas), faixaPara(quantidade, tabela.faixas), tabela.nome);
  },
  "lunari.precificacao.simularPacote": async (sb, uid, args) => {
    const p = await resolvePacote(sb, uid, args);
    if (p.error) return fail(p.error);
    const pacote = p.pacote!;
    const fotosExtras = Math.max(0, Math.floor(Number(args.fotosExtras ?? 0) || 0));
    const valorAdicional = Number(args.valorAdicional ?? 0) || 0;
    const desconto = Number(args.desconto ?? 0) || 0;
    const notas: string[] = [];
    let unit = 0;
    if (fotosExtras > 0) {
      const modelo = await loadModelo(sb, uid);
      if (modelo === "fixo") unit = Number(pacote.valor_foto_extra) || 0;
      else {
        const tabelas = await loadTabelas(sb, uid);
        const tabela = modelo === "global"
          ? tabelas.find((t) => t.tipo === "global")
          : tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === pacote.categoria_id);
        if (!tabela) notas.push("Sem tabela para o modelo ativo — fotos extras calculadas como zero.");
        else if (tabela.usarValorFixoPacote) unit = Number(pacote.valor_foto_extra) || 0;
        else unit = valorPorFoto(fotosExtras, tabela.faixas);
      }
    }
    const valorBase = Number(pacote.valor_base) || 0;
    const valorFotosExtras = unit * fotosExtras;
    const total = valorBase + valorFotosExtras + valorAdicional - desconto;
    if (total < 0) notas.push("O desconto informado deixa o total negativo.");
    return ok(
      {
        pacote: { id: pacote.id, nome: pacote.nome, valorBase: round2(valorBase) },
        valorFotosExtras: round2(valorFotosExtras), valorUnitarioFotoExtra: round2(unit),
        valorAdicional: round2(valorAdicional), desconto: round2(desconto),
        totalCliente: round2(total), notas,
      },
      `${pacote.nome}: base ${money(valorBase)} + extras ${money(valorFotosExtras)} + adicional ${money(valorAdicional)} − desconto ${money(desconto)} = ${money(total)}.`,
    );
  },
  "lunari.precificacao.simularImpactoTabela": async (sb, uid, args) => {
    const novas = parseFaixas(args.faixas);
    const validacao = validarFaixas(novas);
    const escopo = String(args.escopo ?? "global") === "categoria" ? "categoria" : "global";
    let catId: string | null = null;
    if (escopo === "categoria") {
      const cat = await resolveCategoria(sb, uid, args);
      if (cat.error) return fail(cat.error);
      if (!cat.id) return fail("Informe a categoria para simular o escopo por categoria.");
      catId = cat.id;
    }
    const tabelas = await loadTabelas(sb, uid);
    const atual = escopo === "global"
      ? tabelas.find((t) => t.tipo === "global")
      : tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === catId);
    const qtds: number[] = Array.isArray(args.quantidades) && args.quantidades.length
      ? args.quantidades.map((q: any) => Math.floor(Number(q) || 0)).filter((q: number) => q > 0).slice(0, 12)
      : [1, 5, 10, 20, 50];
    const comparativo = qtds.map((q) => {
      const unitAtual = atual ? valorPorFoto(q, atual.faixas) : 0;
      const unitNovo = valorPorFoto(q, novas);
      const totalAtual = unitAtual * q, totalNovo = unitNovo * q;
      return {
        quantidade: q, unitarioAtual: round2(unitAtual), unitarioNovo: round2(unitNovo),
        totalAtual: round2(totalAtual), totalNovo: round2(totalNovo),
        variacaoPercentual: round2(totalAtual > 0 ? ((totalNovo - totalAtual) / totalAtual) * 100 : 0),
      };
    });
    return ok(
      { valida: validacao.valid, erros: validacao.errors, temTabelaAtual: Boolean(atual), comparativo,
        notas: ["Alterar a tabela afeta apenas sessões novas — sessões existentes mantêm as regras congeladas."] },
      (validacao.valid ? "Faixas válidas. " : `Faixas inválidas: ${validacao.errors.join(" ")} `) +
        comparativo.map((c) => `${c.quantidade}: ${money(c.totalAtual)}→${money(c.totalNovo)} (${c.variacaoPercentual}%)`).join(" | "),
    );
  },
  "lunari.configuracoes.listCategorias": async (sb, uid) => {
    const { data, error } = await sb.from("categorias").select("id,nome,cor").eq("user_id", uid).order("nome");
    if (error) return fail(error.message);
    return ok({ items: data ?? [] }, `${data?.length ?? 0} categoria(s): ${(data ?? []).map((c: any) => c.nome).join(", ")}`);
  },
  "lunari.configuracoes.listPacotes": async (sb, uid, args) => {
    const cat = await resolveCategoria(sb, uid, args);
    if (cat.error) return fail(cat.error);
    let q = sb.from("pacotes").select("id,nome,categoria_id,valor_base,valor_foto_extra,fotos_incluidas")
      .eq("user_id", uid).order("nome");
    if (cat.id) q = q.eq("categoria_id", cat.id);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ items: data ?? [] }, `${data?.length ?? 0} pacote(s).`);
  },
};


// -------------------- MUTAÇÕES --------------------
type WriteCfg = { handler: Handler; requiresApproval: boolean; summarize: (a: Record<string, any>) => string };

const WRITE_HANDLERS: Record<string, WriteCfg> = {
  // ---------- PRECIFICAÇÃO ----------
  "lunari.configuracoes.createCategoria": {
    requiresApproval: false,
    summarize: (a) => `Criar categoria "${a.nome ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) return fail("Campo 'nome' é obrigatório.");
      const { data: existe } = await sb.from("categorias").select("id,nome").eq("user_id", uid);
      if ((existe ?? []).some((c: any) => norm(c.nome) === norm(nome))) {
        return fail(`Já existe uma categoria chamada "${nome}".`);
      }
      const { data, error } = await sb.from("categorias")
        .insert({ user_id: uid, nome, cor: args.cor ? String(args.cor) : null })
        .select("id,nome,cor").single();
      if (error) return fail(error.message);
      return ok({ categoria: data }, `Categoria "${data.nome}" criada.`);
    },
  },
  "lunari.configuracoes.createPacote": {
    requiresApproval: false,
    summarize: (a) => `Criar pacote "${a.nome ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) return fail("Campo 'nome' é obrigatório.");
      const cat = await resolveCategoria(sb, uid, args);
      if (cat.error) return fail(cat.error);
      if (!cat.id) return fail("Informe a categoria do pacote.");
      const dup = await pacoteDuplicado(sb, uid, cat.id, nome);
      if (dup) return fail(dup);
      const { data, error } = await sb.from("pacotes").insert({
        user_id: uid,
        nome,
        categoria_id: cat.id,
        valor_base: Number(args.valorBase ?? args.valor_base ?? 0) || 0,
        valor_foto_extra: Number(args.valorFotoExtra ?? args.valor_foto_extra ?? 0) || 0,
        fotos_incluidas: Math.max(0, Math.floor(Number(args.fotosIncluidas ?? args.fotos_incluidas ?? 0) || 0)),
      }).select("id,nome,categoria_id,valor_base,valor_foto_extra,fotos_incluidas").single();
      if (error) return fail(error.message);
      return ok(
        { pacote: data, categoria: cat.nome },
        `Pacote "${data.nome}" criado em ${cat.nome} · base ${money(data.valor_base)} · foto extra ${money(data.valor_foto_extra)} · ${data.fotos_incluidas} foto(s) inclusa(s). Sessões existentes não mudam.`,
      );
    },
  },
  "lunari.precificacao.criarPacotePrecificado": {
    requiresApproval: true,
    summarize: (a) => `Criar pacote precificado "${a.nome ?? "?"}" em ${a.categoria ?? a.categoriaId ?? "categoria"}`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) return fail("Campo 'nome' é obrigatório.");

      let catId = "", catNome = "";
      const cat = await resolveCategoria(sb, uid, args);
      if (cat.id) { catId = cat.id; catNome = cat.nome ?? ""; }
      else if (args.criarCategoria && args.categoria) {
        const { data, error } = await sb.from("categorias")
          .insert({ user_id: uid, nome: String(args.categoria).trim() }).select("id,nome").single();
        if (error) return fail(error.message);
        catId = data.id; catNome = data.nome;
      } else {
        return fail(cat.error ?? "Informe a categoria (use criarCategoria=true para criá-la).");
      }

      const dup = await pacoteDuplicado(sb, uid, catId, nome);
      if (dup) return fail(dup);

      let calc: ReturnType<typeof calcularPrecoFinal> | null = null;
      let markupInfo = "";
      let valorBase = Number(args.valorBase ?? 0) || 0;

      if (!args.valorBase) {
        const horas = Number(args.horasEstimadas ?? 0) || 0;
        if (horas <= 0) return fail("Informe 'horasEstimadas' (ou um 'valorBase' fechado).");
        const estrutura = await loadEstruturaCustos(sb, uid);
        const { markup, origem } = resolverMarkup(args, estrutura.margemLucroDesejada);
        markupInfo = origem;
        calc = calcularPrecoFinal({
          horasEstimadas: horas,
          custoPorHora: estrutura.custoPorHora,
          markup,
          custoProdutos: somaProdutos(args.produtos),
          custosAdicionais: somaCustos(args.custosExtras),
        });
        valorBase = arredondar(calc.precoFinal, Number(args.arredondarPara ?? 0) || 0);
      }

      let valorFotoExtra = Number(args.valorFotoExtra ?? 0) || 0;
      if (!args.valorFotoExtra) {
        const [modelo, tabelas] = await Promise.all([loadModelo(sb, uid), loadTabelas(sb, uid)]);
        const tabela = modelo === "categoria"
          ? tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === catId)
          : tabelas.find((t) => t.tipo === "global");
        if (tabela && !tabela.usarValorFixoPacote) valorFotoExtra = valorPorFoto(1, tabela.faixas);
      }

      const { data, error } = await sb.from("pacotes").insert({
        user_id: uid,
        nome,
        categoria_id: catId,
        valor_base: valorBase,
        valor_foto_extra: valorFotoExtra,
        fotos_incluidas: Math.max(0, Math.floor(Number(args.fotosIncluidas ?? 0) || 0)),
      }).select("id,nome,categoria_id,valor_base,valor_foto_extra,fotos_incluidas").single();
      if (error) return fail(error.message);

      return ok(
        { pacote: data, categoria: catNome, calculo: calc, markup: markupInfo },
        `Pacote "${data.nome}" criado em ${catNome} por ${money(data.valor_base)}` +
          (calc
            ? ` (custo ${money(calc.custoTotal)} · ${markupInfo} · lucratividade ${calc.lucratividade}%)`
            : "") +
          ` · foto extra ${money(data.valor_foto_extra)}. Sessões existentes mantêm as regras congeladas.`,
      );
    },
  },
  "lunari.precificacao.salvarCenario": {
    requiresApproval: false,
    summarize: (a) => `Salvar cenário de precificação "${a.nome ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) return fail("Campo 'nome' é obrigatório.");
      const horas = Number(args.horasEstimadas ?? 0) || 0;
      const estrutura = await loadEstruturaCustos(sb, uid);
      const { markup, origem } = resolverMarkup(args, estrutura.margemLucroDesejada);
      const calc = calcularPrecoFinal({
        horasEstimadas: horas,
        custoPorHora: estrutura.custoPorHora,
        markup,
        custoProdutos: somaProdutos(args.produtos),
        custosAdicionais: somaCustos(args.custosExtras),
      });
      const { data, error } = await sb.from("pricing_calculadora_estados").insert({
        user_id: uid,
        nome,
        horas_estimadas: horas,
        markup,
        produtos: Array.isArray(args.produtos) ? args.produtos : [],
        custos_extras: Array.isArray(args.custosExtras) ? args.custosExtras : [],
        custo_total_calculado: calc.custoTotal,
        preco_final_calculado: calc.precoFinal,
        lucratividade: calc.lucratividade,
        is_default: false,
      }).select("id,nome,preco_final_calculado").single();
      if (error) return fail(error.message);
      return ok(
        { cenario: data, calculo: calc, markup: origem },
        `Cenário "${nome}" salvo · custo ${money(calc.custoTotal)} · preço ${money(calc.precoFinal)} · lucratividade ${calc.lucratividade}% (${origem}). Nenhum preço praticado foi alterado.`,
      );
    },
  },
  "lunari.precificacao.updatePacotePreco": {
    requiresApproval: true,
    summarize: (a) => `Alterar preço do pacote "${a.pacote ?? a.pacoteId ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const p = await resolvePacote(sb, uid, args);
      if (p.error) return fail(p.error);
      const atual = p.pacote!;
      const patch: Record<string, unknown> = {};
      const diff: string[] = [];
      if (args.valorBase !== undefined) {
        patch.valor_base = Number(args.valorBase) || 0;
        diff.push(`base ${money(atual.valor_base)} → ${money(patch.valor_base)}`);
      }
      if (args.valorFotoExtra !== undefined) {
        patch.valor_foto_extra = Number(args.valorFotoExtra) || 0;
        diff.push(`foto extra ${money(atual.valor_foto_extra)} → ${money(patch.valor_foto_extra)}`);
      }
      if (args.fotosIncluidas !== undefined) {
        patch.fotos_incluidas = Math.max(0, Math.floor(Number(args.fotosIncluidas) || 0));
        diff.push(`fotos inclusas ${atual.fotos_incluidas} → ${patch.fotos_incluidas}`);
      }
      if (Object.keys(patch).length === 0) return fail("Informe pelo menos um valor para alterar.");
      const { data, error } = await sb.from("pacotes").update(patch)
        .eq("id", atual.id).eq("user_id", uid)
        .select("id,nome,valor_base,valor_foto_extra,fotos_incluidas").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Pacote não encontrado.");
      return ok(
        { pacote: data, diff },
        `"${data.nome}": ${diff.join(" · ")}. Vale para sessões novas — as existentes mantêm o preço congelado.`,
      );
    },
  },
  "lunari.precificacao.upsertTabelaGlobal": {
    requiresApproval: true,
    summarize: () => "Aplicar nova tabela global de foto extra",
    handler: async (sb, uid, args) => upsertTabela(sb, uid, args, "global", null),
  },
  "lunari.precificacao.upsertTabelaCategoria": {
    requiresApproval: true,
    summarize: (a) => `Aplicar tabela de foto extra da categoria "${a.categoria ?? a.categoriaId ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const cat = await resolveCategoria(sb, uid, args);
      if (cat.error) return fail(cat.error);
      if (!cat.id) return fail("Informe a categoria.");
      return upsertTabela(sb, uid, args, "categoria", cat.id);
    },
  },
  "lunari.precificacao.setModelo": {
    requiresApproval: true,
    summarize: (a) => `Mudar o modelo de preço de foto extra para "${a.modelo ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const modelo = String(args.modelo ?? "");
      if (!["fixo", "global", "categoria"].includes(modelo)) {
        return fail("Modelo deve ser 'fixo', 'global' ou 'categoria'.");
      }
      const { data: atual } = await sb.from("modelo_de_preco").select("id,modelo").eq("user_id", uid).maybeSingle();
      if (atual?.id) {
        const { error } = await sb.from("modelo_de_preco")
          .update({ modelo, updated_at: new Date().toISOString() }).eq("id", atual.id).eq("user_id", uid);
        if (error) return fail(error.message);
      } else {
        const { error } = await sb.from("modelo_de_preco").insert({ user_id: uid, modelo });
        if (error) return fail(error.message);
      }
      return ok(
        { de: atual?.modelo ?? "fixo", para: modelo },
        `Modelo de foto extra: ${atual?.modelo ?? "fixo"} → ${modelo}. Vale para sessões novas.`,
      );
    },
  },
  "lunari.precificacao.updateMargemEHoras": {
    requiresApproval: true,
    summarize: () => "Alterar margem desejada, pró-labore ou horas produtivas",
    handler: async (sb, uid, args) => {
      const patch: Record<string, unknown> = {};
      if (args.margemLucroDesejada !== undefined) patch.margem_lucro_desejada = Number(args.margemLucroDesejada) || 0;
      if (args.percentualProLabore !== undefined) patch.percentual_pro_labore = Number(args.percentualProLabore) || 0;
      if (args.horasDisponiveis !== undefined) patch.horas_disponiveis = Math.max(0, Math.floor(Number(args.horasDisponiveis) || 0));
      if (args.diasTrabalhados !== undefined) patch.dias_trabalhados = Math.max(0, Math.floor(Number(args.diasTrabalhados) || 0));
      if (Object.keys(patch).length === 0) return fail("Informe pelo menos um parâmetro.");
      const antes = await loadEstruturaCustos(sb, uid);
      const { data: cfg } = await sb.from("pricing_configuracoes").select("id").eq("user_id", uid).maybeSingle();
      if (cfg?.id) {
        const { error } = await sb.from("pricing_configuracoes").update(patch).eq("id", cfg.id).eq("user_id", uid);
        if (error) return fail(error.message);
      } else {
        const { error } = await sb.from("pricing_configuracoes").insert({ user_id: uid, ...patch });
        if (error) return fail(error.message);
      }
      const depois = await loadEstruturaCustos(sb, uid);
      return ok(
        { antes, depois },
        `Custo por hora ${money(antes.custoPorHora)} → ${money(depois.custoPorHora)} · margem ${antes.margemLucroDesejada}% → ${depois.margemLucroDesejada}%. Recalcula todas as simulações futuras.`,
      );
    },
  },
  "lunari.precificacao.setMetas": {
    requiresApproval: true,
    summarize: (a) => `Definir metas de ${a.ano ?? "ano atual"}`,
    handler: async (sb, uid, args) => {
      const ano = Math.floor(Number(args.ano ?? new Date().getFullYear()));
      const patch: Record<string, unknown> = { ano_meta: ano };
      if (args.metaFaturamentoAnual !== undefined) patch.meta_faturamento_anual = Number(args.metaFaturamentoAnual) || 0;
      if (args.metaLucroAnual !== undefined) patch.meta_lucro_anual = Number(args.metaLucroAnual) || 0;
      if (args.usarMetasPersonalizadas !== undefined) patch.usar_metas_personalizadas = Boolean(args.usarMetasPersonalizadas);
      const { data: cfg } = await sb.from("pricing_configuracoes").select("id").eq("user_id", uid).maybeSingle();
      if (cfg?.id) {
        const { error } = await sb.from("pricing_configuracoes").update(patch).eq("id", cfg.id).eq("user_id", uid);
        if (error) return fail(error.message);
      } else {
        const { error } = await sb.from("pricing_configuracoes").insert({ user_id: uid, ...patch });
        if (error) return fail(error.message);
      }
      return ok({ ano, patch }, `Metas de ${ano} atualizadas.`);
    },
  },


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

  // ---------- WORKFLOW ----------
  "lunari.workflow.updateFields": {
    requiresApproval: false,
    summarize: (a) => `Atualizar dados da sessão ${a.sessionId ?? a.clienteNome ?? "?"}`,
    handler: async (sb, uid, args) => {
      const r = await resolveSessao(sb, uid, args);
      if (r.error) return fail(r.error);
      const s = r.sessao!;
      const src = (args.fields ?? args) as Record<string, any>;
      const upd: Record<string, unknown> = {};
      for (const key of WORKFLOW_EDITABLE) {
        if (src[key] != null) upd[key] = WORKFLOW_NUMERIC.has(key) ? Number(src[key]) : String(src[key]);
      }
      if (src.qtd_fotos_extra != null) upd.qtd_fotos_extra = Math.max(0, Math.floor(Number(src.qtd_fotos_extra) || 0));
      if (!Object.keys(upd).length) {
        return fail(`Nada para atualizar. Campos aceitos: ${[...WORKFLOW_EDITABLE, "qtd_fotos_extra"].join(", ")}.`);
      }
      upd.updated_by = uid;
      const { error } = await sb.from("clientes_sessoes").update(upd).eq("id", s.id).eq("user_id", uid);
      if (error) return fail(error.message);
      const { data: novo } = await sb.from("clientes_sessoes")
        .select("id,session_id,status,valor_total,valor_pago,status_financeiro,desconto,valor_adicional")
        .eq("id", s.id).maybeSingle();
      return ok(
        { sessionId: s.id, changedKeys: Object.keys(upd).filter((k) => k !== "updated_by"), sessao: novo },
        `Sessão atualizada (${Object.keys(upd).filter((k) => k !== "updated_by").join(", ")}). Total ${money(novo?.valor_total)} · pago ${money(novo?.valor_pago)}.`,
      );
    },
  },
  "lunari.workflow.advanceCard": {
    requiresApproval: false,
    summarize: (a) => `Mover sessão ${a.sessionId ?? a.clienteNome ?? "?"} para "${a.toStatus ?? a.status ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const toStatus = String(args.toStatus ?? args.status ?? "").trim();
      if (!toStatus) return fail("Campo 'toStatus' é obrigatório. Consulte lunari.workflow.statusOptions.");
      const r = await resolveSessao(sb, uid, args);
      if (r.error) return fail(r.error);
      const s = r.sessao!;
      const { data: etapas } = await sb.from("etapas_trabalho").select("nome").eq("user_id", uid);
      const nomes = (etapas ?? []).map((e: any) => e.nome as string);
      const match = nomes.find((n) => norm(n) === norm(toStatus)) ?? nomes.find((n) => norm(n).includes(norm(toStatus)));
      if (nomes.length && !match) {
        return fail(`Etapa "${toStatus}" não existe. Etapas disponíveis: ${nomes.join(", ")}.`);
      }
      const destino = match ?? toStatus;
      if (norm(s.status) === norm(destino)) return ok({ sessionId: s.id, status: destino }, `Sessão já está em "${destino}".`);
      const { error } = await sb.from("clientes_sessoes")
        .update({ status: destino, updated_by: uid }).eq("id", s.id).eq("user_id", uid);
      if (error) return fail(error.message);
      return ok({ sessionId: s.id, fromStatus: s.status ?? null, toStatus: destino }, `Sessão movida de "${s.status ?? "—"}" para "${destino}".`);
    },
  },
  "lunari.workflow.addPayment": {
    requiresApproval: false,
    summarize: (a) => `Registrar pagamento de ${money(a.valor)} na sessão ${a.sessionId ?? a.clienteNome ?? "?"}`,
    handler: async (sb, uid, args) => {
      const valor = Number(args.valor);
      if (!(valor > 0)) return fail("Campo 'valor' (em reais, ex.: 250.00) é obrigatório e deve ser positivo.");
      const r = await resolveSessao(sb, uid, args);
      if (r.error) return fail(r.error);
      const s = r.sessao!;
      if (!s.session_id) return fail("Sessão sem session_id texto — registre o pagamento pelo app.");
      const data = String(args.data ?? args.dataTransacao ?? today());
      const forma = String(args.formaPagamento ?? args.forma ?? "PIX");
      const paymentId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const intentKey = String(args.intentKey ?? `mcp:${s.session_id}:${valor}:${data}:${forma}`);

      // Idempotência: mesma intenção já lançada?
      const { data: dup } = await sb.from("clientes_transacoes")
        .select("id").eq("user_id", uid).eq("session_id", s.session_id).eq("tipo", "pagamento")
        .ilike("descricao", `%[INTENT:${intentKey}]%`).limit(1).maybeSingle();
      if (dup?.id) return ok({ sessionId: s.id, transactionId: dup.id, duplicate: true }, "Pagamento idêntico já registrado — nada foi duplicado.");

      const obs = String(args.descricao ?? args.observacoes ?? `Pagamento ${forma}`);
      const descricao = `${obs} [ID:${paymentId}] [INTENT:${intentKey}]`;
      const { data: inserted, error } = await sb.from("clientes_transacoes").insert({
        user_id: uid,
        cliente_id: s.cliente_id,
        session_id: s.session_id,
        tipo: "pagamento",
        valor,
        data_transacao: data,
        descricao,
        updated_by: uid,
      }).select("id").single();
      if (error) return fail(error.message);

      const { data: novo } = await sb.from("clientes_sessoes")
        .select("valor_total,valor_pago,status_financeiro").eq("id", s.id).maybeSingle();
      const pend = (Number(novo?.valor_total) || 0) - (Number(novo?.valor_pago) || 0);
      return ok(
        { sessionId: s.id, transactionId: inserted.id, valor, data, formaPagamento: forma, sessao: novo },
        `Pagamento de ${money(valor)} (${forma}) registrado em ${data}. Pago ${money(novo?.valor_pago)} de ${money(novo?.valor_total)} · pendente ${money(pend)}.`,
      );
    },
  },
  "lunari.workflow.refundPayment": {
    requiresApproval: true,
    summarize: (a) => `Estornar o pagamento ${a.transactionId ?? "?"} (cria transação espelhada)`,
    handler: async (sb, uid, args) => {
      const transactionId = String(args.transactionId ?? args.id ?? "");
      if (!UUID_RE.test(transactionId)) return fail("Campo 'transactionId' (UUID do pagamento) é obrigatório.");
      const { data: orig } = await sb.from("clientes_transacoes")
        .select("id,user_id,cliente_id,session_id,valor,tipo,descricao")
        .eq("id", transactionId).eq("user_id", uid).maybeSingle();
      if (!orig) return fail("Pagamento não encontrado.");
      if (orig.tipo !== "pagamento") return fail("Somente pagamentos podem ser estornados.");
      if (!(Number(orig.valor) > 0)) return fail("Pagamento sem valor positivo — nada a estornar.");
      const { data: jaEstornado } = await sb.from("clientes_transacoes")
        .select("id").eq("user_id", uid).eq("tipo", "estorno")
        .ilike("descricao", `%[ESTORNO_DE:${transactionId}]%`).limit(1).maybeSingle();
      if (jaEstornado?.id) return ok({ estornoId: jaEstornado.id, duplicate: true }, "Este pagamento já foi estornado.");
      const motivo = args.motivo ? String(args.motivo) : "Estorno via assistente";
      const { data: est, error } = await sb.from("clientes_transacoes").insert({
        user_id: uid,
        cliente_id: orig.cliente_id,
        session_id: orig.session_id,
        tipo: "estorno",
        valor: -Math.abs(Number(orig.valor)),
        data_transacao: today(),
        descricao: `${motivo} [ESTORNO_DE:${transactionId}]`,
        updated_by: uid,
      }).select("id").single();
      if (error) return fail(error.message);
      return ok(
        { transactionId, estornoId: est.id, valorEstornado: Number(orig.valor) },
        `Estorno de ${money(orig.valor)} registrado. Motivo: ${motivo}.`,
      );
    },
  },
  "lunari.workflow.deleteSession": {
    requiresApproval: true,
    summarize: (a) => `Excluir a sessão ${a.sessionId ?? a.clienteNome ?? "?"} e seus lançamentos (irreversível)`,
    handler: async (sb, uid, args) => {
      const r = await resolveSessao(sb, uid, args);
      if (r.error) return fail(r.error);
      const s = r.sessao!;
      const { count } = await sb.from("clientes_transacoes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid).eq("session_id", s.session_id ?? "__none__");
      if ((count ?? 0) > 0 && !args.force) {
        return fail(
          `Esta sessão tem ${count} lançamento(s) financeiro(s) (${money(s.valor_pago)} pago). ` +
            "Reenvie com force=true para excluir sessão e lançamentos.",
        );
      }
      if (s.session_id) {
        await sb.from("clientes_transacoes").delete().eq("user_id", uid).eq("session_id", s.session_id);
      }
      const { error } = await sb.from("clientes_sessoes").delete().eq("id", s.id).eq("user_id", uid);
      if (error) return fail(error.message);
      return ok({ deleted: s.id, transacoesRemovidas: count ?? 0 }, `Sessão excluída (${count ?? 0} lançamento(s) removido(s)).`);
    },
  },
};

/** Campos da sessão que a IA pode alterar (nunca valor_pago/status_financeiro). */
const WORKFLOW_EDITABLE = [
  "descricao",
  "observacoes",
  "detalhes",
  "categoria",
  "pacote",
  "data_sessao",
  "hora_sessao",
  "desconto",
  "valor_adicional",
  "valor_base_pacote",
  "valor_foto_extra",
] as const;

const WORKFLOW_NUMERIC = new Set<string>([
  "desconto",
  "valor_adicional",
  "valor_base_pacote",
  "valor_foto_extra",
]);


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
const SESSION_REF = {
  sessionId: { type: "string", description: "UUID da sessão ou o código de texto (ex.: workflow-123)." },
  clienteNome: { type: "string", description: "Nome do cliente — usado quando o sessionId não é conhecido." },
  latest: { type: "boolean", description: "Se o cliente tiver várias sessões, usar a mais recente." },
} as const;

const FAIXAS_PROP = {
  type: "array",
  description: "Faixas progressivas: contíguas, começando em 1, a última com max nulo (ou mais).",
  items: {
    type: "object",
    properties: {
      min: { type: "number" },
      max: { type: "number", description: "Deixe ausente/nulo na última faixa." },
      valor: { type: "number", description: "Valor por foto em reais." },
    },
    required: ["min", "valor"],
    additionalProperties: false,
  },
} as const;

const PRODUTOS_PROP = {
  type: "array",
  description: "Produtos inclusos com custo unitário.",
  items: {
    type: "object",
    properties: {
      nome: { type: "string" },
      custo: { type: "number", description: "Custo unitário em reais." },
      quantidade: { type: "number" },
    },
    required: ["custo"],
    additionalProperties: false,
  },
} as const;

const CUSTOS_PROP = {
  type: "array",
  description: "Custos extras do trabalho (deslocamento, assistente, locação...).",
  items: {
    type: "object",
    properties: {
      descricao: { type: "string" },
      valorUnitario: { type: "number" },
      quantidade: { type: "number" },
    },
    required: ["valorUnitario"],
    additionalProperties: false,
  },
} as const;

export const BRIDGE_SCHEMAS: Record<string, Record<string, unknown>> = {
  // ---------- ANÁLISE DE VENDAS ----------
  "lunari.workflow.vendas.resumo": {
    type: "object",
    properties: {
      ano: { type: "number", description: "Ano (ex.: 2026). Padrão: ano corrente." },
      mes: { type: "number", description: "Mês 1-12. Omita para o ano inteiro." },
      categoria: { type: "string", description: "Filtrar por categoria (ex.: Newborn)." },
    },
    additionalProperties: false,
  },
  "lunari.workflow.vendas.compararAnos": {
    type: "object",
    properties: {
      anoBase: { type: "number", description: "Ano principal (padrão: ano corrente)." },
      anoComparacao: { type: "number", description: "Ano de comparação (padrão: ano anterior)." },
      limiteMes: { type: "number", description: "Compara só até este mês (1-12). Automático quando omitido." },
      categoria: { type: "string" },
    },
    additionalProperties: false,
  },
  "lunari.workflow.vendas.metasProgresso": {
    type: "object",
    properties: {
      ano: { type: "number", description: "Ano das metas (padrão: corrente)." },
      mes: { type: "number", description: "Mês de referência 1-12 (padrão: mês atual)." },
    },
    additionalProperties: false,
  },
  "lunari.workflow.photoProductionForYear": {
    type: "object",
    properties: {
      year: { type: "number", description: "Ano (padrão: corrente)." },
      categoria: { type: "string" },
    },
    additionalProperties: false,
  },
  // ---------- LEADS (leitura) ----------
  "lunari.leads.list": {
    type: "object",
    properties: {
      status: { type: "string", description: "Chave do estágio do funil." },
      origem: { type: "string" },
      desde: { type: "string", description: "Data inicial YYYY-MM-DD (criação do lead)." },
      ate: { type: "string", description: "Data final YYYY-MM-DD." },
      search: { type: "string", description: "Parte do nome do lead." },
      arquivados: { type: "string", enum: ["ocultar", "incluir", "somente"] },
      limit: { type: "number" },
    },
    additionalProperties: false,
  },
  "lunari.leads.metrics": {
    type: "object",
    properties: {
      desde: { type: "string", description: "Data inicial YYYY-MM-DD (padrão: 1º de janeiro)." },
      ate: { type: "string", description: "Data final YYYY-MM-DD (padrão: hoje)." },
    },
    additionalProperties: false,
  },
  "lunari.leads.get": {
    type: "object",
    properties: { id: { type: "string", description: "UUID do lead ou parte do nome." } },
    required: ["id"],
    additionalProperties: false,
  },
  "lunari.leads.listStatuses": { type: "object", properties: {}, additionalProperties: false },
  // ---------- PRECIFICAÇÃO ----------
  "lunari.precificacao.getConfiguracao": { type: "object", properties: {}, additionalProperties: false },
  "lunari.precificacao.getEstruturaCustos": { type: "object", properties: {}, additionalProperties: false },
  "lunari.precificacao.listTabelas": { type: "object", properties: {}, additionalProperties: false },
  "lunari.precificacao.diagnostico": { type: "object", properties: {}, additionalProperties: false },
  "lunari.precificacao.getTabelaCategoria": {
    type: "object",
    properties: {
      categoria: { type: "string", description: "Nome da categoria (ex.: Newborn) ou UUID." },
      categoriaId: { type: "string" },
    },
    additionalProperties: false,
  },
  "lunari.precificacao.listPacotesComPreco": {
    type: "object",
    properties: { categoria: { type: "string" }, categoriaId: { type: "string" } },
    additionalProperties: false,
  },
  "lunari.precificacao.getMetas": {
    type: "object", properties: { ano: { type: "number" } }, additionalProperties: false,
  },
  "lunari.precificacao.listCenarios": {
    type: "object", properties: { limit: { type: "number" } }, additionalProperties: false,
  },
  "lunari.precificacao.simularPreco": {
    type: "object",
    properties: {
      horasEstimadas: { type: "number", description: "Horas totais do trabalho (captação + edição + entrega)." },
      markup: { type: "number", description: "Multiplicador sobre o custo. Se omitido, deriva da margem desejada." },
      margemDesejada: { type: "number", description: "Margem de lucro alvo em % (alternativa ao markup)." },
      produtos: PRODUTOS_PROP,
      custosExtras: CUSTOS_PROP,
      custoPorHoraOverride: { type: "number" },
    },
    required: ["horasEstimadas"],
    additionalProperties: false,
  },
  "lunari.precificacao.simularFotoExtra": {
    type: "object",
    properties: {
      quantidade: { type: "number" },
      pacote: { type: "string", description: "Nome do pacote (ou UUID em pacoteId)." },
      pacoteId: { type: "string" },
      categoria: { type: "string" },
      categoriaId: { type: "string" },
    },
    required: ["quantidade"],
    additionalProperties: false,
  },
  "lunari.precificacao.simularPacote": {
    type: "object",
    properties: {
      pacote: { type: "string", description: "Nome do pacote." },
      pacoteId: { type: "string" },
      fotosExtras: { type: "number" },
      valorAdicional: { type: "number" },
      desconto: { type: "number" },
    },
    additionalProperties: false,
  },
  "lunari.precificacao.simularImpactoTabela": {
    type: "object",
    properties: {
      escopo: { type: "string", enum: ["global", "categoria"] },
      categoria: { type: "string" },
      categoriaId: { type: "string" },
      faixas: FAIXAS_PROP,
      quantidades: { type: "array", items: { type: "number" } },
    },
    required: ["faixas"],
    additionalProperties: false,
  },
  "lunari.precificacao.criarPacotePrecificado": {
    type: "object",
    properties: {
      nome: { type: "string", description: "Nome do novo pacote." },
      categoria: { type: "string", description: "Nome da categoria (criada se não existir com criarCategoria=true)." },
      categoriaId: { type: "string" },
      criarCategoria: { type: "boolean", description: "Cria a categoria quando ela não existir." },
      horasEstimadas: { type: "number", description: "Horas do trabalho — base do cálculo." },
      markup: { type: "number" },
      margemDesejada: { type: "number", description: "Margem alvo em % (alternativa ao markup)." },
      produtos: PRODUTOS_PROP,
      custosExtras: CUSTOS_PROP,
      valorBase: { type: "number", description: "Se informado, ignora o cálculo e usa este preço." },
      arredondarPara: { type: "number", description: "Arredonda o preço para múltiplos deste valor (ex.: 10)." },
      fotosIncluidas: { type: "number" },
      valorFotoExtra: { type: "number", description: "Se omitido, usa a tabela vigente da categoria." },
    },
    required: ["nome"],
    additionalProperties: false,
  },
  "lunari.precificacao.salvarCenario": {
    type: "object",
    properties: {
      nome: { type: "string", description: "Nome do cenário (ex.: 'Newborn 2026')." },
      horasEstimadas: { type: "number" },
      markup: { type: "number" },
      margemDesejada: { type: "number" },
      produtos: PRODUTOS_PROP,
      custosExtras: CUSTOS_PROP,
    },
    required: ["nome", "horasEstimadas"],
    additionalProperties: false,
  },
  "lunari.precificacao.updatePacotePreco": {
    type: "object",
    properties: {
      pacote: { type: "string", description: "Nome do pacote." },
      pacoteId: { type: "string" },
      valorBase: { type: "number" },
      valorFotoExtra: { type: "number" },
      fotosIncluidas: { type: "number" },
    },
    additionalProperties: false,
  },
  "lunari.precificacao.upsertTabelaGlobal": {
    type: "object",
    properties: { nome: { type: "string" }, faixas: FAIXAS_PROP, usarValorFixoPacote: { type: "boolean" } },
    required: ["faixas"],
    additionalProperties: false,
  },
  "lunari.precificacao.upsertTabelaCategoria": {
    type: "object",
    properties: {
      categoria: { type: "string" },
      categoriaId: { type: "string" },
      nome: { type: "string" },
      faixas: FAIXAS_PROP,
      usarValorFixoPacote: { type: "boolean" },
    },
    required: ["faixas"],
    additionalProperties: false,
  },
  "lunari.precificacao.setModelo": {
    type: "object",
    properties: { modelo: { type: "string", enum: ["fixo", "global", "categoria"] } },
    required: ["modelo"],
    additionalProperties: false,
  },
  "lunari.precificacao.updateMargemEHoras": {
    type: "object",
    properties: {
      margemLucroDesejada: { type: "number", description: "Margem alvo em %." },
      percentualProLabore: { type: "number" },
      horasDisponiveis: { type: "number", description: "Horas produtivas por dia." },
      diasTrabalhados: { type: "number", description: "Dias por semana." },
    },
    additionalProperties: false,
  },
  "lunari.precificacao.setMetas": {
    type: "object",
    properties: {
      ano: { type: "number" },
      metaFaturamentoAnual: { type: "number" },
      metaLucroAnual: { type: "number" },
      usarMetasPersonalizadas: { type: "boolean" },
    },
    additionalProperties: false,
  },
  "lunari.configuracoes.listCategorias": { type: "object", properties: {}, additionalProperties: false },
  "lunari.configuracoes.listPacotes": {
    type: "object",
    properties: { categoria: { type: "string" }, categoriaId: { type: "string" } },
    additionalProperties: false,
  },
  "lunari.configuracoes.createCategoria": {
    type: "object",
    properties: { nome: { type: "string" }, cor: { type: "string" } },
    required: ["nome"],
    additionalProperties: false,
  },
  "lunari.configuracoes.createPacote": {
    type: "object",
    properties: {
      nome: { type: "string" },
      categoria: { type: "string", description: "Nome da categoria." },
      categoriaId: { type: "string" },
      valorBase: { type: "number" },
      valorFotoExtra: { type: "number" },
      fotosIncluidas: { type: "number" },
    },
    required: ["nome"],
    additionalProperties: false,
  },

  "lunari.workflow.getCardBySession": {
    type: "object", properties: { ...SESSION_REF }, additionalProperties: false,
  },
  "lunari.workflow.getSessionFinancials": {
    type: "object", properties: { ...SESSION_REF }, additionalProperties: false,
  },
  "lunari.workflow.diagnoseSession": {
    type: "object", properties: { ...SESSION_REF }, additionalProperties: false,
  },
  "lunari.workflow.produto.listBySession": {
    type: "object", properties: { ...SESSION_REF }, additionalProperties: false,
  },
  "lunari.workflow.produto.listPending": {
    type: "object", properties: { limit: { type: "number" } }, additionalProperties: false,
  },
  "lunari.workflow.listSessionsByPaymentStatus": {
    type: "object",
    properties: {
      statusFinanceiro: { type: "string", description: "pendente, parcial, pago ou quitado." },
      limit: { type: "number" },
    },
    additionalProperties: false,
  },
  "lunari.workflow.statusOptions": { type: "object", properties: {}, additionalProperties: false },
  "lunari.workflow.metricsForMonth": {
    type: "object",
    properties: {
      year: { type: "number", description: "Ano (padrão: atual)." },
      month: { type: "number", description: "Mês 1-12 (padrão: atual)." },
    },
    additionalProperties: false,
  },
  "lunari.workflow.photoProductionForMonth": {
    type: "object",
    properties: { year: { type: "number" }, month: { type: "number" }, categoria: { type: "string" } },
    additionalProperties: false,
  },
  "lunari.workflow.metricsForRange": {
    type: "object",
    properties: {
      start: { type: "string", description: "Data inicial YYYY-MM-DD." },
      end: { type: "string", description: "Data final YYYY-MM-DD." },
      granularity: { type: "string", enum: ["day", "week", "month"] },
      includeHistorico: { type: "boolean" },
    },
    additionalProperties: false,
  },
  "lunari.workflow.analytics.summary": {
    type: "object",
    properties: {
      start: { type: "string" },
      end: { type: "string" },
      includeHistorico: { type: "boolean" },
    },
    additionalProperties: false,
  },
  "lunari.workflow.updateFields": {
    type: "object",
    properties: {
      ...SESSION_REF,
      descricao: { type: "string" },
      observacoes: { type: "string" },
      detalhes: { type: "string" },
      categoria: { type: "string" },
      pacote: { type: "string" },
      data_sessao: { type: "string", description: "Data YYYY-MM-DD." },
      hora_sessao: { type: "string", description: "Hora HH:MM." },
      desconto: { type: "number", description: "Desconto em reais." },
      valor_adicional: { type: "number", description: "Valor adicional em reais." },
      valor_base_pacote: { type: "number" },
      valor_foto_extra: { type: "number", description: "Preço unitário da foto extra." },
      qtd_fotos_extra: { type: "number" },
    },
    additionalProperties: false,
  },
  "lunari.workflow.advanceCard": {
    type: "object",
    properties: { ...SESSION_REF, toStatus: { type: "string", description: "Etapa de destino (ver statusOptions)." } },
    required: ["toStatus"],
    additionalProperties: false,
  },
  "lunari.workflow.addPayment": {
    type: "object",
    properties: {
      ...SESSION_REF,
      valor: { type: "number", description: "Valor em reais (ex.: 250.00)." },
      data: { type: "string", description: "Data do pagamento YYYY-MM-DD (padrão: hoje)." },
      formaPagamento: { type: "string", description: "PIX, Cartão, Dinheiro, Transferência..." },
      descricao: { type: "string", description: "Observação do lançamento." },
    },
    required: ["valor"],
    additionalProperties: false,
  },
  "lunari.workflow.refundPayment": {
    type: "object",
    properties: {
      transactionId: { type: "string", description: "UUID do pagamento a estornar." },
      motivo: { type: "string" },
    },
    required: ["transactionId"],
    additionalProperties: false,
  },
  "lunari.workflow.deleteSession": {
    type: "object",
    properties: { ...SESSION_REF, force: { type: "boolean", description: "Excluir mesmo com lançamentos financeiros." } },
    additionalProperties: false,
  },

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
