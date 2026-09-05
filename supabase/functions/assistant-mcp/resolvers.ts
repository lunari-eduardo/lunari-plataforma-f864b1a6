// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  McpToolResult,
  NeedsInputOption,
  needsInput,
  ok,
  fail,
  norm,
  money,
  toMinutes,
  addDays,
  SESSAO_COLS,
  UUID_RE,
} from "./types.ts";
import { parseFaixas, validarFaixas, loadTabelas, valorPorFoto } from "./pricing.ts";

export async function resolveCategoria(
  sb: SupabaseClient, uid: string, args: Record<string, any>,
): Promise<{ id: string | null; nome?: string; error?: string; ask?: McpToolResult }> {
  const raw = String(args.categoriaId ?? args.categoria ?? "").trim();
  const { data, error } = await sb.from("categorias").select("id,nome").eq("user_id", uid);
  if (error) return { id: null, error: error.message };
  const list = data ?? [];
  const opcoes = (): NeedsInputOption[] => list.slice(0, 20).map((c: any) => ({ label: c.nome, value: c.id }));
  if (!raw) return { id: null };
  const byId = list.find((c: any) => c.id === raw);
  if (byId) return { id: byId.id, nome: byId.nome };
  const alvo = norm(raw);
  const exata = list.find((c: any) => norm(c.nome) === alvo);
  if (exata) return { id: exata.id, nome: exata.nome };
  const parciais = list.filter((c: any) => norm(c.nome).includes(alvo));
  if (parciais.length === 1) return { id: parciais[0].id, nome: parciais[0].nome };
  if (parciais.length > 1) {
    return {
      id: null,
      ask: needsInput({
        missing: ["categoriaId"],
        question: `Qual categoria você quis dizer com "${raw}"?`,
        options: parciais.slice(0, 10).map((c: any) => ({ label: c.nome, value: c.id })),
      }),
    };
  }
  return {
    id: null,
    ask: needsInput({
      missing: ["categoriaId"],
      question: `Não existe a categoria "${raw}". Qual das categorias cadastradas devo usar?`,
      options: opcoes(),
      allowCreate: true,
      createHint: "Nunca crie categoria sozinho: só crie se o usuário confirmar explicitamente o nome.",
    }),
  };
}

export async function askCategoriaObrigatoria(
  sb: SupabaseClient, uid: string,
): Promise<McpToolResult> {
  const { data } = await sb.from("categorias").select("id,nome").eq("user_id", uid);
  return needsInput({
    missing: ["categoria"],
    question: "Todo pacote precisa de uma categoria. Qual delas devo usar?",
    options: (data ?? []).slice(0, 20).map((c: any) => ({ label: c.nome, value: c.id })),
    allowCreate: true,
    createHint: "Se nenhuma servir, pergunte ao usuário o nome da nova categoria antes de criar.",
  });
}

export async function resolvePacote(
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

export async function pacoteDuplicado(
  sb: SupabaseClient, uid: string, categoriaId: string, nome: string,
): Promise<string | null> {
  const { data } = await sb.from("pacotes").select("nome").eq("user_id", uid).eq("categoria_id", categoriaId);
  return (data ?? []).some((p: any) => norm(p.nome) === norm(nome))
    ? `Já existe um pacote "${nome}" nessa categoria.` : null;
}

export async function upsertTabela(
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

export async function resolveCliente(
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

export async function resolveFinanceItem(
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

export async function resolveSessao(
  sb: SupabaseClient,
  uid: string,
  args: Record<string, any>,
): Promise<{ sessao: any | null; error?: string; ask?: McpToolResult }> {
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
  if (cli.ask) return { sessao: null, ask: cli.ask };
  if (cli.error) return { sessao: null, error: cli.error };
  if (!cli.id) {
    return {
      sessao: null,
      ask: needsInput({
        missing: ["sessionId"],
        question: "De qual sessão você está falando? Informe o cliente ou o identificador da sessão.",
      }),
    };
  }
  const { data } = await sb.from("clientes_sessoes").select(SESSAO_COLS)
    .eq("user_id", uid).eq("cliente_id", cli.id)
    .order("data_sessao", { ascending: false }).limit(10);
  const list = data ?? [];
  if (list.length === 0) return { sessao: null, error: `Nenhuma sessão para "${cli.nome}".` };
  if (list.length > 1 && !args.latest) {
    return {
      sessao: null,
      ask: needsInput({
        missing: ["sessionId"],
        question: `"${cli.nome}" tem ${list.length} sessões. Qual delas?`,
        options: list.map((s: any) => ({
          label: `${s.data_sessao ?? "sem data"} — ${s.pacote ?? s.categoria ?? "sem pacote"}`,
          value: s.id,
          hint: s.status ?? undefined,
        })),
      }),
    };
  }
  return { sessao: list[0] };
}

export function monthRange(args: Record<string, any>): { start: string; end: string } {
  const now = new Date();
  const year = Number(args.year) || now.getUTCFullYear();
  const month = Number(args.month) || now.getUTCMonth() + 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const end = addDays(`${nextY}-${String(nextM).padStart(2, "0")}-01`, -1);
  return { start, end };
}

export function projetarProdutos(sessao: any) {
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

export async function appointmentsInDay(sb: SupabaseClient, uid: string, date: string) {
  const { data } = await sb.from("appointments")
    .select("id,time,duration_minutes,title").eq("user_id", uid).eq("date", date);
  return data ?? [];
}

export function conflictAt(
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
