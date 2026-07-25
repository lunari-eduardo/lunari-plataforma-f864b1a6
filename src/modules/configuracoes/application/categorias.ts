/**
 * Capabilities operacionais — Categorias.
 *
 * P6.A (piloto). Escrita passa pelo Supabase client existente; RLS garante
 * isolamento por `user_id`. Handlers permanecem finos: sem regra de negócio
 * além de normalização/duplicidade de nome.
 */
import { z } from "zod";
import { defineCommand, defineQuery } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";

const CategoriaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  cor: z.string().nullable(),
});

export const listCategoriasCap = defineQuery({
  id: "configuracoes.listCategorias",
  title: "Listar categorias",
  description: "Retorna todas as categorias do estúdio ordenadas por nome.",
  input: z.object({}).strict(),
  output: z.object({ items: z.array(CategoriaSchema) }),
  permissions: ["auth"],
  handler: async () => {
    const { data, error } = await supabase
      .from("categorias")
      .select("id, nome, cor")
      .order("nome");
    if (error) return err(domainError("DB", error.message));
    return ok({ items: data ?? [] });
  },
});

export const getCategoriaCap = defineQuery({
  id: "configuracoes.getCategoria",
  title: "Obter categoria",
  description: "Retorna os dados de uma categoria pelo id.",
  input: z.object({ id: z.string() }).strict(),
  output: CategoriaSchema.nullable(),
  permissions: ["auth"],
  handler: async ({ id }) => {
    const { data, error } = await supabase
      .from("categorias")
      .select("id, nome, cor")
      .eq("id", id)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    return ok(data ?? null);
  },
});

export const createCategoriaCap = defineCommand({
  id: "configuracoes.createCategoria",
  title: "Criar categoria",
  description: "Cria uma nova categoria. Falha se nome duplicado.",
  input: z.object({
    nome: z.string(),
    cor: z.string().nullable().optional(),
  }).strict(),
  output: CategoriaSchema,
  permissions: ["auth"],
  sideEffects: ["db:categorias"],
  handler: async ({ nome, cor }, ctx) => {
    const trimmed = nome.trim();
    if (trimmed.length === 0) {
      return err(domainError("VALIDATION", "O nome da categoria não pode ficar vazio."));
    }
    if (trimmed.length > 60) {
      return err(domainError("VALIDATION", "Nome muito longo (máx 60 caracteres)."));
    }
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));

    const { data: dup } = await supabase
      .from("categorias")
      .select("id")
      .ilike("nome", trimmed)
      .limit(1);
    if (dup && dup.length > 0) {
      return err(domainError("CONFLICT", "Já existe uma categoria com esse nome."));
    }

    const { data, error } = await supabase
      .from("categorias")
      .insert({ nome: trimmed, cor: cor ?? null, user_id: ctx.user.id })
      .select("id, nome, cor")
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(data);
  },
});

export const updateCategoriaCap = defineCommand({
  id: "configuracoes.updateCategoria",
  title: "Editar categoria",
  description:
    "Atualiza nome e/ou cor de uma categoria. Renomear é seguro para sessões congeladas.",
  input: z.object({
    id: z.string(),
    nome: z.string().optional(),
    cor: z.string().nullable().optional(),
  }).strict(),
  output: CategoriaSchema,
  permissions: ["auth"],
  sideEffects: ["db:categorias"],
  handler: async ({ id, nome, cor }) => {
    const patch: Record<string, unknown> = {};
    if (nome !== undefined) {
      const trimmed = nome.trim();
      if (trimmed.length === 0) {
        return err(domainError("VALIDATION", "Nome não pode ficar vazio."));
      }
      if (trimmed.length > 60) {
        return err(domainError("VALIDATION", "Nome muito longo (máx 60 caracteres)."));
      }
      patch.nome = trimmed;
    }
    if (cor !== undefined) patch.cor = cor;
    if (Object.keys(patch).length === 0) {
      return err(domainError("VALIDATION", "Informe pelo menos um campo para atualizar."));
    }
    const { data, error } = await supabase
      .from("categorias")
      .update(patch)
      .eq("id", id)
      .select("id, nome, cor")
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Categoria não encontrada."));
    return ok(data);
  },
});

export const deleteCategoriaCap = defineCommand({
  id: "configuracoes.deleteCategoria",
  title: "Excluir categoria",
  description:
    "Remove definitivamente a categoria. Bloqueado se houver pacotes ou sessões vinculados.",
  input: z.object({ id: z.string() }).strict(),
  output: z.object({ deleted: z.boolean() }),
  permissions: ["auth"],
  needsApproval: true,
  sideEffects: ["db:categorias"],
  handler: async ({ id }) => {
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string, o?: unknown) => {
          eq: (col: string, v: string) => Promise<{ count: number | null }>;
        };
      };
    };
    const pacotesRes = await sb
      .from("pacotes")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", id);
    const sessoesRes = await sb
      .from("clientes_sessoes")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", id);
    const pacotesCount = pacotesRes.count ?? 0;
    const sessoesCount = sessoesRes.count ?? 0;
    if ((pacotesCount ?? 0) > 0 || (sessoesCount ?? 0) > 0) {
      return err(
        domainError(
          "CONFLICT",
          "Categoria em uso por pacotes ou sessões. Reatribua antes de excluir.",
          { details: { pacotes: pacotesCount ?? 0, sessoes: sessoesCount ?? 0 } },
        ),
      );
    }
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) return err(domainError("DB", error.message));
    return ok({ deleted: true });
  },
});

export const CATEGORIA_CAPABILITIES = [
  listCategoriasCap,
  getCategoriaCap,
  createCategoriaCap,
  updateCategoriaCap,
  deleteCategoriaCap,
];
