/**
 * Capabilities operacionais — Pacotes.
 *
 * P6.A tranche 2. RLS por `user_id`. Delete valida vínculo com sessões
 * (clientes_sessoes.pacote_id) para não quebrar histórico.
 */
import { z } from "zod";
import { defineCommand, defineQuery } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";

const PacoteSchema = z.object({
  id: z.string(),
  nome: z.string(),
  categoria_id: z.string(),
  valor_base: z.number(),
  valor_foto_extra: z.number(),
  fotos_incluidas: z.number(),
});

export const listPacotesCap = defineQuery({
  id: "configuracoes.listPacotes",
  title: "Listar pacotes",
  description: "Lista pacotes; opcionalmente filtra por categoria.",
  input: z.object({ categoriaId: z.string().optional() }).strict(),
  output: z.object({ items: z.array(PacoteSchema) }),
  permissions: [],
  handler: async ({ categoriaId }) => {
    let q = supabase
      .from("pacotes")
      .select("id, nome, categoria_id, valor_base, valor_foto_extra, fotos_incluidas")
      .order("nome");
    if (categoriaId) q = q.eq("categoria_id", categoriaId);
    const { data, error } = await q;
    if (error) return err(domainError("DB", error.message));
    return ok({ items: data ?? [] });
  },
});

export const createPacoteCap = defineCommand({
  id: "configuracoes.createPacote",
  title: "Criar pacote",
  description: "Cria pacote em uma categoria com valores e fotos inclusas.",
  input: z.object({
    nome: z.string(),
    categoria_id: z.string(),
    valor_base: z.number().nonnegative(),
    valor_foto_extra: z.number().nonnegative().default(0),
    fotos_incluidas: z.number().int().nonnegative().default(0),
  }).strict(),
  output: PacoteSchema,
  permissions: [],
  sideEffects: ["db:pacotes"],
  handler: async (input, ctx) => {
    const nome = input.nome.trim();
    if (!nome) return err(domainError("VALIDATION", "Nome do pacote é obrigatório."));
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));
    const { data, error } = await supabase
      .from("pacotes")
      .insert({
        nome,
        categoria_id: input.categoria_id,
        valor_base: input.valor_base,
        valor_foto_extra: input.valor_foto_extra,
        fotos_incluidas: input.fotos_incluidas,
        user_id: ctx.user.id,
      })
      .select("id, nome, categoria_id, valor_base, valor_foto_extra, fotos_incluidas")
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(data);
  },
});

export const updatePacoteCap = defineCommand({
  id: "configuracoes.updatePacote",
  title: "Editar pacote",
  description: "Atualiza campos do pacote. Valores futuros; sessões congeladas mantêm o preço.",
  input: z.object({
    id: z.string(),
    nome: z.string().optional(),
    categoria_id: z.string().optional(),
    valor_base: z.number().nonnegative().optional(),
    valor_foto_extra: z.number().nonnegative().optional(),
    fotos_incluidas: z.number().int().nonnegative().optional(),
  }).strict(),
  output: PacoteSchema,
  permissions: [],
  sideEffects: ["db:pacotes"],
  handler: async ({ id, ...patch }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
    if (typeof clean.nome === "string") clean.nome = (clean.nome as string).trim();
    if (Object.keys(clean).length === 0) {
      return err(domainError("VALIDATION", "Informe pelo menos um campo."));
    }
    const { data, error } = await supabase
      .from("pacotes")
      .update(clean)
      .eq("id", id)
      .select("id, nome, categoria_id, valor_base, valor_foto_extra, fotos_incluidas")
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Pacote não encontrado."));
    return ok(data);
  },
});

export const deletePacoteCap = defineCommand({
  id: "configuracoes.deletePacote",
  title: "Excluir pacote",
  description: "Remove definitivamente. Bloqueado se houver sessões usando esse pacote.",
  input: z.object({ id: z.string() }).strict(),
  output: z.object({ deleted: z.boolean() }),
  permissions: [],
  needsApproval: true,
  sideEffects: ["db:pacotes"],
  handler: async ({ id }) => {
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string, o?: unknown) => {
          eq: (col: string, v: string) => Promise<{ count: number | null }>;
        };
      };
    };
    const res = await sb
      .from("clientes_sessoes")
      .select("id", { count: "exact", head: true })
      .eq("pacote_id", id);
    if ((res.count ?? 0) > 0) {
      return err(
        domainError("CONFLICT", "Pacote em uso por sessões. Reatribua antes de excluir.", {
          details: { sessoes: res.count },
        }),
      );
    }
    const { error } = await supabase.from("pacotes").delete().eq("id", id);
    if (error) return err(domainError("DB", error.message));
    return ok({ deleted: true });
  },
});
