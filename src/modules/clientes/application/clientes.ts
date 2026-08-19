/**
 * Capabilities operacionais — módulo Clientes (Onda D.1).
 *
 * v1: leitura + create/update + nota livre em `observacoes`.
 * Fora do escopo v1 (exigem plano dedicado): delete, merge, ajuste de créditos,
 * família, documentos. Todas as escritas passam por RLS em `clientes` (user_id).
 */
import { z } from "zod";
import { defineCommand, defineQuery } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";

const ClienteRowSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  uf: z.string().nullable().optional(),
  cpf_cnpj: z.string().nullable().optional(),
  origem: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

const SELECT_COLS =
  "id, nome, email, telefone, whatsapp, cidade, uf, cpf_cnpj, origem, observacoes, created_at, updated_at";

export const listClientesCap = defineQuery({
  id: "clientes.list",
  title: "Listar clientes",
  description:
    "Lista clientes do fotógrafo ordenados por nome (padrão). Suporta paginação leve.",
  input: z
    .object({
      limit: z.number().int().positive().default(50),
      offset: z.number().int().nonnegative().default(0),
      orderBy: z.enum(["nome", "recent"]).default("nome"),
    })
    .strict(),
  output: z.object({ items: z.array(ClienteRowSchema), count: z.number() }),
  permissions: ["clientes:read"],
  handler: async ({ limit, offset, orderBy }) => {
    const q = supabase
      .from("clientes")
      .select(SELECT_COLS, { count: "exact" })
      .range(offset, offset + limit - 1);
    const query =
      orderBy === "recent"
        ? q.order("updated_at", { ascending: false })
        : q.order("nome", { ascending: true });
    const { data, error, count } = await query;
    if (error) return err(domainError("DB", error.message));
    return ok({ items: data ?? [], count: count ?? 0 });
  },
});

export const getClienteCap = defineQuery({
  id: "clientes.get",
  title: "Obter cliente",
  description: "Retorna um cliente pelo id.",
  input: z.object({ id: z.string() }).strict(),
  output: ClienteRowSchema.nullable(),
  permissions: ["clientes:read"],
  handler: async ({ id }) => {
    const { data, error } = await supabase
      .from("clientes")
      .select(SELECT_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    return ok(data ?? null);
  },
});

export const searchClientesCap = defineQuery({
  id: "clientes.search",
  title: "Buscar clientes",
  description:
    "Busca por nome, email, telefone ou CPF/CNPJ (contém, case-insensitive). Limite 20.",
  input: z.object({ q: z.string() }).strict(),
  output: z.object({ items: z.array(ClienteRowSchema) }),
  permissions: ["clientes:read"],
  handler: async ({ q }) => {
    const term = q.trim();
    if (term.length < 2) return ok({ items: [] });
    const like = `%${term}%`;
    const { data, error } = await supabase
      .from("clientes")
      .select(SELECT_COLS)
      .or(
        `nome.ilike.${like},email.ilike.${like},telefone.ilike.${like},cpf_cnpj.ilike.${like}`,
      )
      .limit(20);
    if (error) return err(domainError("DB", error.message));
    return ok({ items: data ?? [] });
  },
});

export const searchAndMatchClientesCap = defineQuery({
  id: "clientes.searchAndMatch",
  title: "Buscar e desambiguar clientes",
  description:
    "Busca clientes pelo nome ou termo para identificar o cliente correto ou detectar homônimos quando houver ambiguidade.",
  input: z.object({ nameOrQuery: z.string().min(1).describe("Nome ou termo de busca do cliente") }),
  output: z.object({
    matchCount: z.number().int().nonnegative(),
    isAmbiguous: z.boolean(),
    exactMatch: ClienteRowSchema.nullable(),
    candidates: z.array(
      z.object({
        id: z.string(),
        nome: z.string(),
        email: z.string().nullable().optional(),
        telefone: z.string().nullable().optional(),
        cidade: z.string().nullable().optional(),
        tipo: z.string().nullable().optional(),
      })
    ),
  }),
  permissions: ["clientes:read"],
  handler: async ({ nameOrQuery }) => {
    const term = nameOrQuery.trim();
    if (!term) return ok({ matchCount: 0, isAmbiguous: false, exactMatch: null, candidates: [] });
    const like = `%${term}%`;
    const { data, error } = await supabase
      .from("clientes")
      .select(SELECT_COLS)
      .or(`nome.ilike.${like},email.ilike.${like},telefone.ilike.${like}`)
      .limit(10);

    if (error) return err(domainError("DB", error.message));
    const items = data ?? [];

    // 1. Se exatamente 1 cliente foi retornado, é ele (sem ambiguidade)
    if (items.length === 1) {
      return ok({
        matchCount: 1,
        isAmbiguous: false,
        exactMatch: items[0],
        candidates: items,
      });
    }

    // 2. Se houver correspondência exata de nome completo (case-insensitive)
    const exact = items.find((c) => c.nome?.trim().toLowerCase() === term.toLowerCase());
    if (exact) {
      return ok({
        matchCount: items.length,
        isAmbiguous: false,
        exactMatch: exact,
        candidates: items,
      });
    }

    // 3. Múltiplos clientes encontrados (ambiguidade real)
    return ok({
      matchCount: items.length,
      isAmbiguous: items.length > 1,
      exactMatch: null,
      candidates: items.map((c) => ({
        id: c.id,
        nome: c.nome,
        email: c.email,
        telefone: c.telefone,
        cidade: c.cidade,
        tipo: c.tipo,
      })),
    });
  },
});

export const listClienteSessoesCap = defineQuery({
  id: "clientes.listSessoes",
  title: "Listar sessões do cliente",
  description: "Retorna sessões vinculadas ao cliente (mais recentes primeiro).",
  input: z
    .object({ clienteId: z.string(), limit: z.number().int().positive().default(20) })
    .strict(),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        descricao: z.string().nullable().optional(),
        data_sessao: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        valor_total: z.number().nullable().optional(),
        valor_pago: z.number().nullable().optional(),
      }),
    ),
  }),
  permissions: ["clientes:read"],
  handler: async ({ clienteId, limit }) => {
    const { data, error } = await supabase
      .from("clientes_sessoes")
      .select("id, descricao, data_sessao, status, valor_total, valor_pago")
      .eq("cliente_id", clienteId)
      .order("data_sessao", { ascending: false })
      .limit(limit);
    if (error) return err(domainError("DB", error.message));
    return ok({ items: (data ?? []) as never });
  },
});

export const listClienteTransacoesCap = defineQuery({
  id: "clientes.listTransacoes",
  title: "Listar transações do cliente",
  description:
    "Retorna transações financeiras (entradas/saídas) vinculadas ao cliente, mais recentes primeiro.",
  input: z
    .object({ clienteId: z.string(), limit: z.number().int().positive().default(30) })
    .strict(),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        descricao: z.string().nullable().optional(),
        valor: z.number().nullable().optional(),
        tipo: z.string().nullable().optional(),
        data_transacao: z.string().nullable().optional(),
      }),
    ),
  }),
  permissions: ["clientes:read"],
  handler: async ({ clienteId, limit }) => {
    const { data, error } = await supabase
      .from("clientes_transacoes")
      .select("id, descricao, valor, tipo, data_transacao")
      .eq("cliente_id", clienteId)
      .order("data_transacao", { ascending: false })
      .limit(limit);
    if (error) return err(domainError("DB", error.message));
    return ok({ items: (data ?? []) as never });
  },
});

const CreateClienteInput = z
  .object({
    nome: z.string(),
    email: z.string().nullable().optional(),
    telefone: z.string().nullable().optional(),
    whatsapp: z.string().nullable().optional(),
    cpf_cnpj: z.string().nullable().optional(),
    cidade: z.string().nullable().optional(),
    uf: z.string().nullable().optional(),
    origem: z.string().nullable().optional(),
    observacoes: z.string().nullable().optional(),
  })
  .strict();

export const createClienteCap = defineCommand({
  id: "clientes.create",
  title: "Criar cliente",
  description:
    "Cria um cliente novo. Nome obrigatório; email/telefone opcionais. Duplicado por email/telefone gera aviso, não bloqueio.",
  input: CreateClienteInput,
  output: ClienteRowSchema,
  permissions: ["clientes:write"],
  sideEffects: ["db:clientes"],
  handler: async (input, ctx) => {
    const nome = input.nome.trim();
    if (nome.length === 0) return err(domainError("VALIDATION", "Nome é obrigatório."));
    if (nome.length > 120) return err(domainError("VALIDATION", "Nome muito longo."));
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));

    const payload = {
      user_id: ctx.user.id,
      nome,
      email: input.email ?? null,
      telefone: input.telefone ?? null,
      whatsapp: input.whatsapp ?? null,
      cpf_cnpj: input.cpf_cnpj ?? null,
      cidade: input.cidade ?? null,
      uf: input.uf ?? null,
      origem: input.origem ?? "manual",
      observacoes: input.observacoes ?? null,
    };
    const { data, error } = await supabase
      .from("clientes")
      .insert(payload)
      .select(SELECT_COLS)
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(data);
  },
});

const UpdateClienteInput = z
  .object({
    id: z.string(),
    nome: z.string().optional(),
    email: z.string().nullable().optional(),
    telefone: z.string().nullable().optional(),
    whatsapp: z.string().nullable().optional(),
    cpf_cnpj: z.string().nullable().optional(),
    cidade: z.string().nullable().optional(),
    uf: z.string().nullable().optional(),
    observacoes: z.string().nullable().optional(),
  })
  .strict();

export const updateClienteCap = defineCommand({
  id: "clientes.update",
  title: "Atualizar cliente",
  description: "Atualiza campos do cliente. Só campos informados são alterados.",
  input: UpdateClienteInput,
  output: ClienteRowSchema,
  permissions: ["clientes:write"],
  sideEffects: ["db:clientes"],
  handler: async (input) => {
    const { id, ...rest } = input;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (Object.keys(patch).length === 0) {
      return err(domainError("VALIDATION", "Informe pelo menos um campo para atualizar."));
    }
    if (typeof patch.nome === "string") {
      const nome = (patch.nome as string).trim();
      if (nome.length === 0) return err(domainError("VALIDATION", "Nome não pode ficar vazio."));
      patch.nome = nome;
    }
    const { data, error } = await supabase
      .from("clientes")
      .update(patch)
      .eq("id", id)
      .select(SELECT_COLS)
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Cliente não encontrado."));
    return ok(data);
  },
});

export const addClienteNotaCap = defineCommand({
  id: "clientes.addNota",
  title: "Adicionar nota ao cliente",
  description:
    "Anexa uma linha de observação ao histórico do cliente (campo observacoes). Não sobrescreve.",
  input: z
    .object({
      id: z.string(),
      nota: z.string(),
    })
    .strict(),
  output: ClienteRowSchema,
  permissions: ["clientes:write"],
  sideEffects: ["db:clientes"],
  handler: async ({ id, nota }) => {
    const trimmed = nota.trim();
    if (trimmed.length === 0) return err(domainError("VALIDATION", "Nota vazia."));
    if (trimmed.length > 500) return err(domainError("VALIDATION", "Nota muito longa (máx 500)."));

    const { data: current, error: fetchErr } = await supabase
      .from("clientes")
      .select("observacoes")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) return err(domainError("DB", fetchErr.message));
    if (!current) return err(domainError("NOT_FOUND", "Cliente não encontrado."));

    const stamp = new Date().toISOString().slice(0, 10);
    const line = `[${stamp}] ${trimmed}`;
    const next = current.observacoes ? `${current.observacoes}\n${line}` : line;

    const { data, error } = await supabase
      .from("clientes")
      .update({ observacoes: next })
      .eq("id", id)
      .select(SELECT_COLS)
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(data);
  },
});
