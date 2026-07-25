/**
 * Capabilities operacionais — Formulários (briefings).
 *
 * P6.B — CRUD + publish/unpublish + geração IA. Publish exige aprovação
 * humana (expõe URL pública). Geração IA é assistida por Edge Function
 * `assistant-forms-generate` que consome LOVABLE_API_KEY.
 */
import { z } from "zod";
import { defineCommand, defineQuery } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";

const CAMPO_TIPOS = [
  "texto_curto",
  "texto_longo",
  "data",
  "selecao_unica",
  "multipla_escolha",
  "upload_imagem",
  "upload_referencia",
  "selecao_cores",
] as const;

const CampoSchema = z.object({
  id: z.string(),
  tipo: z.enum(CAMPO_TIPOS),
  pergunta: z.string(),
  obrigatorio: z.boolean().optional(),
  opcoes: z.array(z.string()).optional(),
  descricao: z.string().optional(),
});

const FormSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  status: z.string(),
  status_envio: z.string(),
  cliente_id: z.string().nullable(),
  session_id: z.string().nullable(),
  public_token: z.string().nullable(),
  campos: z.array(CampoSchema),
  created_at: z.string(),
});

const FormSummarySchema = z.object({
  id: z.string(),
  titulo: z.string(),
  status: z.string(),
  status_envio: z.string(),
  cliente_id: z.string().nullable(),
  respondido_em: z.string().nullable(),
  created_at: z.string(),
});

function toFormRow(row: Record<string, unknown>) {
  return {
    ...row,
    campos: Array.isArray(row.campos) ? row.campos : [],
  };
}

export const listFormsCap = defineQuery({
  id: "formularios.listForms",
  title: "Listar formulários",
  description: "Lista formulários do usuário; filtros opcionais por status/cliente.",
  input: z.object({
    status: z.string().optional(),
    clienteId: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
  }).strict(),
  output: z.object({ items: z.array(FormSummarySchema) }),
  permissions: [],
  handler: async ({ status, clienteId, search, limit }) => {
    let q = supabase
      .from("formularios")
      .select("id, titulo, status, status_envio, cliente_id, respondido_em, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    if (clienteId) q = q.eq("cliente_id", clienteId);
    if (search) q = q.ilike("titulo", `%${search}%`);
    const { data, error } = await q;
    if (error) return err(domainError("DB", error.message));
    return ok({ items: data ?? [] });
  },
});

export const getFormCap = defineQuery({
  id: "formularios.getForm",
  title: "Obter formulário",
  description: "Retorna o formulário completo (com campos).",
  input: z.object({ id: z.string() }).strict(),
  output: FormSchema.nullable(),
  permissions: [],
  handler: async ({ id }) => {
    const { data, error } = await supabase
      .from("formularios")
      .select(
        "id, titulo, descricao, status, status_envio, cliente_id, session_id, public_token, campos, created_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    return ok(data ? (toFormRow(data) as z.infer<typeof FormSchema>) : null);
  },
});

export const createFormCap = defineCommand({
  id: "formularios.createForm",
  title: "Criar formulário",
  description:
    "Cria formulário em rascunho. Aceita lista de campos (esquema Lunari).",
  input: z.object({
    titulo: z.string(),
    descricao: z.string().optional(),
    cliente_id: z.string().nullable().optional(),
    session_id: z.string().nullable().optional(),
    campos: z.array(CampoSchema).default([]),
  }).strict(),
  output: FormSchema,
  permissions: [],
  sideEffects: ["db:formularios"],
  handler: async (input, ctx) => {
    const titulo = input.titulo.trim();
    if (!titulo) return err(domainError("VALIDATION", "Título é obrigatório."));
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));
    const { data, error } = await supabase
      .from("formularios")
      .insert({
        titulo,
        descricao: input.descricao ?? null,
        cliente_id: input.cliente_id ?? null,
        session_id: input.session_id ?? null,
        campos: input.campos as unknown as never,
        status: "rascunho",
        user_id: ctx.user.id,
      })
      .select(
        "id, titulo, descricao, status, status_envio, cliente_id, session_id, public_token, campos, created_at",
      )
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(toFormRow(data) as z.infer<typeof FormSchema>);
  },
});

export const updateFormCap = defineCommand({
  id: "formularios.updateForm",
  title: "Editar formulário",
  description: "Atualiza título/descrição/campos (rascunho ou publicado).",
  input: z.object({
    id: z.string(),
    titulo: z.string().optional(),
    descricao: z.string().nullable().optional(),
    campos: z.array(CampoSchema).optional(),
    cliente_id: z.string().nullable().optional(),
    session_id: z.string().nullable().optional(),
  }).strict(),
  output: FormSchema,
  permissions: [],
  sideEffects: ["db:formularios"],
  handler: async ({ id, ...patch }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
    if (typeof clean.titulo === "string") clean.titulo = (clean.titulo as string).trim();
    if (Object.keys(clean).length === 0) {
      return err(domainError("VALIDATION", "Informe pelo menos um campo."));
    }
    const { data, error } = await supabase
      .from("formularios")
      .update(clean)
      .eq("id", id)
      .select(
        "id, titulo, descricao, status, status_envio, cliente_id, session_id, public_token, campos, created_at",
      )
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Formulário não encontrado."));
    return ok(toFormRow(data) as z.infer<typeof FormSchema>);
  },
});

export const publishFormCap = defineCommand({
  id: "formularios.publishForm",
  title: "Publicar formulário",
  description:
    "Publica o formulário e gera public_token se ainda não existir. Torna a URL acessível.",
  input: z.object({ id: z.string() }).strict(),
  output: FormSchema,
  permissions: [],
  needsApproval: true,
  sideEffects: ["db:formularios"],
  handler: async ({ id }) => {
    const { data: cur } = await supabase
      .from("formularios")
      .select("public_token, campos")
      .eq("id", id)
      .maybeSingle();
    if (!cur) return err(domainError("NOT_FOUND", "Formulário não encontrado."));
    if (!Array.isArray(cur.campos) || (cur.campos as unknown[]).length === 0) {
      return err(domainError("VALIDATION", "Adicione pelo menos um campo antes de publicar."));
    }
    const patch: Record<string, unknown> = { status: "publicado" };
    if (!cur.public_token) patch.public_token = crypto.randomUUID().replace(/-/g, "");
    const { data, error } = await supabase
      .from("formularios")
      .update(patch)
      .eq("id", id)
      .select(
        "id, titulo, descricao, status, status_envio, cliente_id, session_id, public_token, campos, created_at",
      )
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(toFormRow(data) as z.infer<typeof FormSchema>);
  },
});

export const unpublishFormCap = defineCommand({
  id: "formularios.unpublishForm",
  title: "Despublicar formulário",
  description: "Volta o formulário para rascunho; URL pública deixa de aceitar respostas.",
  input: z.object({ id: z.string() }).strict(),
  output: FormSchema,
  permissions: [],
  needsApproval: true,
  sideEffects: ["db:formularios"],
  handler: async ({ id }) => {
    const { data, error } = await supabase
      .from("formularios")
      .update({ status: "rascunho" })
      .eq("id", id)
      .select(
        "id, titulo, descricao, status, status_envio, cliente_id, session_id, public_token, campos, created_at",
      )
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Formulário não encontrado."));
    return ok(toFormRow(data) as z.infer<typeof FormSchema>);
  },
});

export const deleteFormCap = defineCommand({
  id: "formularios.deleteForm",
  title: "Excluir formulário",
  description: "Remove definitivamente o formulário e suas respostas.",
  input: z.object({ id: z.string() }).strict(),
  output: z.object({ deleted: z.boolean() }),
  permissions: [],
  needsApproval: true,
  sideEffects: ["db:formularios"],
  handler: async ({ id }) => {
    const { error } = await supabase.from("formularios").delete().eq("id", id);
    if (error) return err(domainError("DB", error.message));
    return ok({ deleted: true });
  },
});

export const listResponsesCap = defineQuery({
  id: "formularios.listResponses",
  title: "Listar respostas",
  description: "Lista respostas de um formulário.",
  input: z.object({ formId: z.string() }).strict(),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        formulario_id: z.string(),
        created_at: z.string(),
        respostas: z.any(),
      }),
    ),
  }),
  permissions: [],
  handler: async ({ formId }) => {
    const { data, error } = await supabase
      .from("formulario_respostas")
      .select("id, formulario_id, created_at, respostas")
      .eq("formulario_id", formId)
      .order("created_at", { ascending: false });
    if (error) return err(domainError("DB", error.message));
    return ok({ items: (data ?? []) as never[] });
  },
});

/**
 * Geração de formulário assistida por IA. Delegada para Edge Function
 * `assistant-forms-generate` que possui a LOVABLE_API_KEY. Retorna somente
 * a proposta de campos; usuário revisa antes de create/publish.
 */
export const generateFormWithAICap = defineCommand({
  id: "formularios.generateFormWithAI",
  title: "Gerar formulário com IA",
  description:
    "Propõe título/descrição/campos com base em um brief. Não cria nada — retorna apenas a proposta.",
  input: z.object({
    brief: z.string().min(4),
    tipoEnsaio: z.string().optional(),
    clienteNome: z.string().optional(),
    idiomaOutput: z.enum(["pt-BR", "en"]).default("pt-BR"),
  }).strict(),
  output: z.object({
    titulo: z.string(),
    descricao: z.string(),
    campos: z.array(CampoSchema),
  }),
  permissions: [],
  needsApproval: true,
  sideEffects: ["external:lovable-ai"],
  handler: async (input) => {
    const { data, error } = await supabase.functions.invoke("assistant-forms-generate", {
      body: input,
    });
    if (error) return err(domainError("AI", error.message));
    if (!data || typeof data !== "object") {
      return err(domainError("AI", "Resposta vazia da IA."));
    }
    const parsed = z
      .object({
        titulo: z.string(),
        descricao: z.string(),
        campos: z.array(CampoSchema),
      })
      .safeParse(data);
    if (!parsed.success) {
      return err(domainError("AI", "IA retornou formato inválido: " + parsed.error.message));
    }
    return ok(parsed.data);
  },
});
