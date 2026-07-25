/**
 * Capabilities operacionais — Contratos.
 *
 * P6.C — CRUD de templates + instâncias + geração IA. Geração IA delega
 * para a Edge Function `assistant-contracts-generate` (LOVABLE_API_KEY).
 */
import { z } from "zod";
import { defineCommand, defineQuery } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";
import { CONTRATO_VARIAVEIS_SUPORTADAS } from "../domain/types";

const TemplateSchema = z.object({
  id: z.string(),
  nome: z.string(),
  descricao: z.string().nullable(),
  categoria: z.string().nullable(),
  conteudo: z.string(),
  ativo: z.boolean(),
  is_padrao: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const TemplateSummarySchema = z.object({
  id: z.string(),
  nome: z.string(),
  categoria: z.string().nullable(),
  ativo: z.boolean(),
  is_padrao: z.boolean(),
  updated_at: z.string(),
});

const ContratoSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  conteudo: z.string(),
  status: z.string(),
  cliente_id: z.string(),
  session_id: z.string().nullable(),
  template_id: z.string().nullable(),
  observacoes: z.string().nullable(),
  enviado_em: z.string().nullable(),
  assinado_em: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const ContratoSummarySchema = z.object({
  id: z.string(),
  titulo: z.string(),
  status: z.string(),
  cliente_id: z.string(),
  session_id: z.string().nullable(),
  template_id: z.string().nullable(),
  enviado_em: z.string().nullable(),
  assinado_em: z.string().nullable(),
  updated_at: z.string(),
});

const TEMPLATE_COLS =
  "id, nome, descricao, categoria, conteudo, ativo, is_padrao, created_at, updated_at";
const TEMPLATE_SUMMARY_COLS =
  "id, nome, categoria, ativo, is_padrao, updated_at";
const CONTRATO_COLS =
  "id, titulo, conteudo, status, cliente_id, session_id, template_id, observacoes, enviado_em, assinado_em, created_at, updated_at";
const CONTRATO_SUMMARY_COLS =
  "id, titulo, status, cliente_id, session_id, template_id, enviado_em, assinado_em, updated_at";

/* ============================ TEMPLATES ============================ */

export const listTemplatesCap = defineQuery({
  id: "contratos.listTemplates",
  title: "Listar templates de contrato",
  description: "Lista templates do usuário. Filtros opcionais por categoria/ativo/busca.",
  input: z.object({
    categoria: z.string().optional(),
    ativo: z.boolean().optional(),
    search: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
  }).strict(),
  output: z.object({ items: z.array(TemplateSummarySchema) }),
  permissions: [],
  handler: async ({ categoria, ativo, search, limit }) => {
    let q = supabase
      .from("contrato_templates")
      .select(TEMPLATE_SUMMARY_COLS)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);
    if (categoria) q = q.eq("categoria", categoria);
    if (typeof ativo === "boolean") q = q.eq("ativo", ativo);
    if (search) q = q.ilike("nome", `%${search}%`);
    const { data, error } = await q;
    if (error) return err(domainError("DB", error.message));
    return ok({ items: (data ?? []) as z.infer<typeof TemplateSummarySchema>[] });
  },
});

export const getTemplateCap = defineQuery({
  id: "contratos.getTemplate",
  title: "Obter template",
  description: "Retorna o template completo (com conteúdo).",
  input: z.object({ id: z.string() }).strict(),
  output: TemplateSchema.nullable(),
  permissions: [],
  handler: async ({ id }) => {
    const { data, error } = await supabase
      .from("contrato_templates")
      .select(TEMPLATE_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    return ok((data ?? null) as z.infer<typeof TemplateSchema> | null);
  },
});

export const createTemplateCap = defineCommand({
  id: "contratos.createTemplate",
  title: "Criar template",
  description: "Cria template de contrato (inativo por padrão até revisão).",
  input: z.object({
    nome: z.string(),
    descricao: z.string().nullable().optional(),
    categoria: z.string().nullable().optional(),
    conteudo: z.string(),
    ativo: z.boolean().optional(),
  }).strict(),
  output: TemplateSchema,
  permissions: [],
  sideEffects: ["db:contrato_templates"],
  handler: async (input, ctx) => {
    const nome = input.nome.trim();
    if (!nome) return err(domainError("VALIDATION", "Nome é obrigatório."));
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));
    const { data, error } = await supabase
      .from("contrato_templates")
      .insert({
        nome,
        descricao: input.descricao ?? null,
        categoria: input.categoria ?? null,
        conteudo: input.conteudo ?? "",
        ativo: input.ativo ?? true,
        user_id: ctx.user.id,
      })
      .select(TEMPLATE_COLS)
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(data as z.infer<typeof TemplateSchema>);
  },
});

export const updateTemplateCap = defineCommand({
  id: "contratos.updateTemplate",
  title: "Editar template",
  description: "Atualiza nome/descrição/categoria/conteúdo/ativo.",
  input: z.object({
    id: z.string(),
    nome: z.string().optional(),
    descricao: z.string().nullable().optional(),
    categoria: z.string().nullable().optional(),
    conteudo: z.string().optional(),
    ativo: z.boolean().optional(),
  }).strict(),
  output: TemplateSchema,
  permissions: [],
  sideEffects: ["db:contrato_templates"],
  handler: async ({ id, ...patch }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
    if (typeof clean.nome === "string") clean.nome = (clean.nome as string).trim();
    if (Object.keys(clean).length === 0) {
      return err(domainError("VALIDATION", "Informe pelo menos um campo."));
    }
    const { data, error } = await supabase
      .from("contrato_templates")
      .update(clean)
      .eq("id", id)
      .select(TEMPLATE_COLS)
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Template não encontrado."));
    return ok(data as z.infer<typeof TemplateSchema>);
  },
});

export const deleteTemplateCap = defineCommand({
  id: "contratos.deleteTemplate",
  title: "Excluir template",
  description: "Exclusão definitiva do template.",
  input: z.object({ id: z.string() }).strict(),
  output: z.object({ deleted: z.boolean() }),
  permissions: [],
  needsApproval: true,
  sideEffects: ["db:contrato_templates"],
  handler: async ({ id }) => {
    const { error } = await supabase.from("contrato_templates").delete().eq("id", id);
    if (error) return err(domainError("DB", error.message));
    return ok({ deleted: true });
  },
});

/* ============================ CONTRATOS ============================ */

export const listContratosCap = defineQuery({
  id: "contratos.listContratos",
  title: "Listar contratos",
  description: "Lista contratos com filtros por status/cliente/sessão.",
  input: z.object({
    status: z.string().optional(),
    clienteId: z.string().optional(),
    sessionId: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
  }).strict(),
  output: z.object({ items: z.array(ContratoSummarySchema) }),
  permissions: [],
  handler: async ({ status, clienteId, sessionId, search, limit }) => {
    let q = supabase
      .from("contratos")
      .select(CONTRATO_SUMMARY_COLS)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    if (clienteId) q = q.eq("cliente_id", clienteId);
    if (sessionId) q = q.eq("session_id", sessionId);
    if (search) q = q.ilike("titulo", `%${search}%`);
    const { data, error } = await q;
    if (error) return err(domainError("DB", error.message));
    return ok({ items: (data ?? []) as z.infer<typeof ContratoSummarySchema>[] });
  },
});

export const getContratoCap = defineQuery({
  id: "contratos.getContrato",
  title: "Obter contrato",
  description: "Retorna o contrato completo (com conteúdo).",
  input: z.object({ id: z.string() }).strict(),
  output: ContratoSchema.nullable(),
  permissions: [],
  handler: async ({ id }) => {
    const { data, error } = await supabase
      .from("contratos")
      .select(CONTRATO_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    return ok((data ?? null) as z.infer<typeof ContratoSchema> | null);
  },
});

export const createContratoCap = defineCommand({
  id: "contratos.createContrato",
  title: "Criar contrato",
  description:
    "Cria contrato em rascunho para um cliente. Aceita template opcional; conteúdo é copiado do template.",
  input: z.object({
    titulo: z.string(),
    cliente_id: z.string(),
    session_id: z.string().nullable().optional(),
    template_id: z.string().nullable().optional(),
    conteudo: z.string().optional(),
    observacoes: z.string().nullable().optional(),
  }).strict(),
  output: ContratoSchema,
  permissions: [],
  sideEffects: ["db:contratos"],
  handler: async (input, ctx) => {
    const titulo = input.titulo.trim();
    if (!titulo) return err(domainError("VALIDATION", "Título é obrigatório."));
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));

    let conteudo = input.conteudo?.trim() ?? "";
    if (!conteudo && input.template_id) {
      const { data: tpl, error: tplErr } = await supabase
        .from("contrato_templates")
        .select("conteudo")
        .eq("id", input.template_id)
        .maybeSingle();
      if (tplErr) return err(domainError("DB", tplErr.message));
      if (!tpl) return err(domainError("NOT_FOUND", "Template não encontrado."));
      conteudo = tpl.conteudo ?? "";
    }

    const { data, error } = await supabase
      .from("contratos")
      .insert({
        titulo,
        cliente_id: input.cliente_id,
        session_id: input.session_id ?? null,
        template_id: input.template_id ?? null,
        conteudo,
        observacoes: input.observacoes ?? null,
        status: "rascunho",
        user_id: ctx.user.id,
      })
      .select(CONTRATO_COLS)
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(data as z.infer<typeof ContratoSchema>);
  },
});

export const updateContratoCap = defineCommand({
  id: "contratos.updateContrato",
  title: "Editar contrato",
  description:
    "Atualiza título/conteúdo/observações/session_id (enquanto o contrato não estiver assinado).",
  input: z.object({
    id: z.string(),
    titulo: z.string().optional(),
    conteudo: z.string().optional(),
    observacoes: z.string().nullable().optional(),
    session_id: z.string().nullable().optional(),
  }).strict(),
  output: ContratoSchema,
  permissions: [],
  sideEffects: ["db:contratos"],
  handler: async ({ id, ...patch }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
    if (typeof clean.titulo === "string") clean.titulo = (clean.titulo as string).trim();
    if (Object.keys(clean).length === 0) {
      return err(domainError("VALIDATION", "Informe pelo menos um campo."));
    }
    const { data: cur } = await supabase
      .from("contratos")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (cur?.status === "assinado") {
      return err(domainError("VALIDATION", "Contrato já assinado — não pode ser editado."));
    }
    const { data, error } = await supabase
      .from("contratos")
      .update(clean)
      .eq("id", id)
      .select(CONTRATO_COLS)
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Contrato não encontrado."));
    return ok(data as z.infer<typeof ContratoSchema>);
  },
});

export const markSentContratoCap = defineCommand({
  id: "contratos.markSentContrato",
  title: "Marcar contrato como enviado",
  description:
    "Marca `enviado_em = now()` e status = 'enviado'. Não envia mensagens — apenas registra.",
  input: z.object({ id: z.string() }).strict(),
  output: ContratoSchema,
  permissions: [],
  needsApproval: true,
  sideEffects: ["db:contratos"],
  handler: async ({ id }) => {
    const { data, error } = await supabase
      .from("contratos")
      .update({ status: "enviado", enviado_em: new Date().toISOString() })
      .eq("id", id)
      .select(CONTRATO_COLS)
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Contrato não encontrado."));
    return ok(data as z.infer<typeof ContratoSchema>);
  },
});

export const deleteContratoCap = defineCommand({
  id: "contratos.deleteContrato",
  title: "Excluir contrato",
  description: "Exclusão definitiva do contrato.",
  input: z.object({ id: z.string() }).strict(),
  output: z.object({ deleted: z.boolean() }),
  permissions: [],
  needsApproval: true,
  sideEffects: ["db:contratos"],
  handler: async ({ id }) => {
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) return err(domainError("DB", error.message));
    return ok({ deleted: true });
  },
});

/* ============================ AI GENERATION ============================ */

const AIGenSchema = z.object({
  titulo: z.string(),
  conteudo: z.string(),
  variaveisUsadas: z.array(z.string()),
  observacoes: z.string().optional(),
});

export const generateTemplateWithAICap = defineCommand({
  id: "contratos.generateTemplateWithAI",
  title: "Gerar template de contrato com IA",
  description:
    "Propõe título e conteúdo (com placeholders {{variavel}}) para um novo template. Não grava — retorna a proposta.",
  input: z.object({
    brief: z.string().min(4),
    categoria: z.string().optional(),
    tipoEnsaio: z.string().optional(),
    idiomaOutput: z.enum(["pt-BR", "en"]).default("pt-BR"),
  }).strict(),
  output: AIGenSchema,
  permissions: [],
  needsApproval: true,
  sideEffects: ["external:lovable-ai"],
  handler: async (input) => {
    const { data, error } = await supabase.functions.invoke(
      "assistant-contracts-generate",
      { body: { mode: "template", ...input } },
    );
    if (error) return err(domainError("AI", error.message));
    if (!data || typeof data !== "object") {
      return err(domainError("AI", "Resposta vazia da IA."));
    }
    const parsed = AIGenSchema.safeParse(data);
    if (!parsed.success) {
      return err(domainError("AI", "IA retornou formato inválido: " + parsed.error.message));
    }
    return ok(parsed.data);
  },
});

export const generateContratoWithAICap = defineCommand({
  id: "contratos.generateContratoWithAI",
  title: "Personalizar contrato com IA",
  description:
    "Gera conteúdo do contrato para um cliente/sessão específico, usando dados do estúdio. Retorna proposta.",
  input: z.object({
    clienteId: z.string(),
    sessionId: z.string().optional(),
    templateId: z.string().optional(),
    brief: z.string().min(4),
    idiomaOutput: z.enum(["pt-BR", "en"]).default("pt-BR"),
  }).strict(),
  output: AIGenSchema,
  permissions: [],
  needsApproval: true,
  sideEffects: ["external:lovable-ai"],
  handler: async (input) => {
    const { data, error } = await supabase.functions.invoke(
      "assistant-contracts-generate",
      {
        body: {
          mode: "contrato",
          ...input,
          variaveisSuportadas: CONTRATO_VARIAVEIS_SUPORTADAS,
        },
      },
    );
    if (error) return err(domainError("AI", error.message));
    if (!data || typeof data !== "object") {
      return err(domainError("AI", "Resposta vazia da IA."));
    }
    const parsed = AIGenSchema.safeParse(data);
    if (!parsed.success) {
      return err(domainError("AI", "IA retornou formato inválido: " + parsed.error.message));
    }
    return ok(parsed.data);
  },
});
