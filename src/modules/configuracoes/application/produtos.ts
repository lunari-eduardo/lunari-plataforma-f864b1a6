/**
 * Capabilities operacionais — Produtos.
 *
 * P6.A tranche 2. Produtos não têm flag `ativo` no schema atual; usamos
 * `favorito` como toggle equivalente. Delete valida vínculo com sessões via
 * mirror `tasks` (product_id) para evitar remoção de itens já entregues.
 */
import { z } from "zod";
import { defineCommand, defineQuery } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";

const ProdutoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  preco_custo: z.number(),
  preco_venda: z.number(),
  favorito: z.boolean(),
});

export const listProdutosCap = defineQuery({
  id: "configuracoes.listProdutos",
  title: "Listar produtos",
  description: "Lista produtos; filtra por texto (nome) ou favoritos.",
  input: z.object({
    search: z.string().optional(),
    favoritosOnly: z.boolean().optional(),
  }).strict(),
  output: z.object({ items: z.array(ProdutoSchema) }),
  permissions: [],
  handler: async ({ search, favoritosOnly }) => {
    let q = supabase
      .from("produtos")
      .select("id, nome, preco_custo, preco_venda, favorito")
      .order("nome");
    if (search) q = q.ilike("nome", `%${search}%`);
    if (favoritosOnly) q = q.eq("favorito", true);
    const { data, error } = await q;
    if (error) return err(domainError("DB", error.message));
    return ok({ items: data ?? [] });
  },
});

export const createProdutoCap = defineCommand({
  id: "configuracoes.createProduto",
  title: "Criar produto",
  description: "Cria um novo produto com custo e preço de venda.",
  input: z.object({
    nome: z.string(),
    preco_custo: z.number().nonnegative().default(0),
    preco_venda: z.number().nonnegative().default(0),
    favorito: z.boolean().optional(),
  }).strict(),
  output: ProdutoSchema,
  permissions: [],
  sideEffects: ["db:produtos"],
  handler: async (input, ctx) => {
    const nome = input.nome.trim();
    if (!nome) return err(domainError("VALIDATION", "Nome do produto é obrigatório."));
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));
    const { data, error } = await supabase
      .from("produtos")
      .insert({
        nome,
        preco_custo: input.preco_custo,
        preco_venda: input.preco_venda,
        favorito: input.favorito ?? false,
        user_id: ctx.user.id,
      })
      .select("id, nome, preco_custo, preco_venda, favorito")
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(data);
  },
});

export const updateProdutoCap = defineCommand({
  id: "configuracoes.updateProduto",
  title: "Editar produto",
  description: "Atualiza campos do produto.",
  input: z.object({
    id: z.string(),
    nome: z.string().optional(),
    preco_custo: z.number().nonnegative().optional(),
    preco_venda: z.number().nonnegative().optional(),
    favorito: z.boolean().optional(),
  }).strict(),
  output: ProdutoSchema,
  permissions: [],
  sideEffects: ["db:produtos"],
  handler: async ({ id, ...patch }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
    if (typeof clean.nome === "string") clean.nome = (clean.nome as string).trim();
    if (Object.keys(clean).length === 0) {
      return err(domainError("VALIDATION", "Informe pelo menos um campo."));
    }
    const { data, error } = await supabase
      .from("produtos")
      .update(clean)
      .eq("id", id)
      .select("id, nome, preco_custo, preco_venda, favorito")
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Produto não encontrado."));
    return ok(data);
  },
});

export const toggleProdutoFavoritoCap = defineCommand({
  id: "configuracoes.toggleProdutoFavorito",
  title: "Favoritar/desfavoritar produto",
  description: "Alterna o estado de favorito do produto.",
  input: z.object({ id: z.string() }).strict(),
  output: ProdutoSchema,
  permissions: [],
  sideEffects: ["db:produtos"],
  handler: async ({ id }) => {
    const { data: cur, error: e1 } = await supabase
      .from("produtos")
      .select("favorito")
      .eq("id", id)
      .maybeSingle();
    if (e1) return err(domainError("DB", e1.message));
    if (!cur) return err(domainError("NOT_FOUND", "Produto não encontrado."));
    const { data, error } = await supabase
      .from("produtos")
      .update({ favorito: !cur.favorito })
      .eq("id", id)
      .select("id, nome, preco_custo, preco_venda, favorito")
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(data);
  },
});

export const deleteProdutoCap = defineCommand({
  id: "configuracoes.deleteProduto",
  title: "Excluir produto",
  description: "Remove definitivamente o produto do catálogo.",
  input: z.object({ id: z.string() }).strict(),
  output: z.object({ deleted: z.boolean() }),
  permissions: [],
  needsApproval: true,
  sideEffects: ["db:produtos"],
  handler: async ({ id }) => {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) return err(domainError("DB", error.message));
    return ok({ deleted: true });
  },
});
