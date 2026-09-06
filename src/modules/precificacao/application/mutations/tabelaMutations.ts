import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";
import { round2, validarFaixas } from "../../domain/calculo";
import type { Json } from "@/integrations/supabase/types";
import type { FaixaPreco } from "../../domain/types";
import { FaixaSchema, loadModelo, loadTabelas } from "../leitura";
import { AVISO_CONGELAMENTO, DiffSchema } from "./common";

/* ============================== MODELO ============================== */

export const setModeloCap = defineCommand({
  id: "precificacao.setModelo",
  title: "Alterar modelo de precificação",
  description:
    "Troca o modelo de cobrança de foto extra entre valor fixo do pacote, tabela global progressiva ou tabela por categoria. Requer aprovação.",
  input: z.object({ modelo: z.enum(["fixo", "global", "categoria"]) }).strict(),
  output: z.object({
    modelo: z.enum(["fixo", "global", "categoria"]),
    diff: DiffSchema,
    aviso: z.string(),
  }),
  permissions: [],
  sideEffects: ["db:modelo_de_preco"],
  handler: async ({ modelo }, ctx) => {
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));

    try {
      const atual = await loadModelo();
      if (atual === modelo) {
        return err(domainError("CONFLICT", `O modelo já é "${modelo}".`));
      }

      const tabelas = await loadTabelas();
      if (modelo === "global" && !tabelas.some((t) => t.tipo === "global")) {
        return err(
          domainError(
            "VALIDATION",
            "Não existe tabela global configurada. Crie a tabela antes de trocar o modelo.",
          ),
        );
      }
      if (modelo === "categoria" && tabelas.filter((t) => t.tipo === "categoria").length === 0) {
        return err(
          domainError(
            "VALIDATION",
            "Nenhuma categoria tem tabela configurada. Crie ao menos uma antes de trocar o modelo.",
          ),
        );
      }

      const { data: existing } = await supabase
        .from("modelo_de_preco")
        .select("id")
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("modelo_de_preco")
          .update({ modelo, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) return err(domainError("DB", error.message));
      } else {
        const { error } = await supabase
          .from("modelo_de_preco")
          .insert({ modelo, user_id: ctx.user.id });
        if (error) return err(domainError("DB", error.message));
      }

      return ok({
        modelo,
        diff: [{ campo: "Modelo de preço", de: atual, para: modelo }],
        aviso: AVISO_CONGELAMENTO,
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

/* ============================== TABELAS ============================== */

async function upsertTabela(params: {
  userId: string;
  tipo: "global" | "categoria";
  categoriaId: string | null;
  nome: string;
  faixas: FaixaPreco[];
  usarValorFixoPacote: boolean;
}) {
  const tabelas = await loadTabelas();
  const atual =
    params.tipo === "global"
      ? tabelas.find((t) => t.tipo === "global")
      : tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === params.categoriaId);

  const payload = {
    nome: params.nome,
    tipo: params.tipo,
    categoria_id: params.categoriaId,
    faixas: params.faixas as unknown as Json,
    usar_valor_fixo_pacote: params.usarValorFixoPacote,
    updated_at: new Date().toISOString(),
  };

  if (atual) {
    const { error } = await supabase.from("tabelas_precos").update(payload).eq("id", atual.id);
    if (error) throw new Error(error.message);
    return { id: atual.id, anterior: atual };
  }

  const { data, error } = await supabase
    .from("tabelas_precos")
    .insert({ ...payload, user_id: params.userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, anterior: null };
}

function diffFaixas(
  antes: FaixaPreco[] | null,
  depois: FaixaPreco[],
): Array<{ campo: string; de: string; para: string }> {
  const fmt = (f: FaixaPreco[] | null) =>
    !f || f.length === 0
      ? "(sem tabela)"
      : f
          .map((x) => `${x.min}-${x.max ?? "+"}: R$ ${round2(x.valor)}`)
          .join(" | ");
  return [{ campo: "Faixas", de: fmt(antes), para: fmt(depois) }];
}

export const upsertTabelaGlobalCap = defineCommand({
  id: "precificacao.upsertTabelaGlobal",
  title: "Atualizar tabela global de foto extra",
  description:
    "Substitui as faixas progressivas da tabela global de fotos extras. Faixas precisam ser contíguas, começar em 1 e terminar aberta. Requer aprovação.",
  input: z
    .object({
      nome: z.string().max(80).optional(),
      faixas: z.array(FaixaSchema).min(1),
      usarValorFixoPacote: z.boolean().default(false),
    })
    .strict(),
  output: z.object({
    id: z.string(),
    diff: DiffSchema,
    aviso: z.string(),
  }),
  permissions: [],
  sideEffects: ["db:tabelas_precos"],
  handler: async ({ nome, faixas, usarValorFixoPacote }, ctx) => {
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));
    const novas = faixas as unknown as FaixaPreco[];
    const validacao = validarFaixas(novas);
    if (!validacao.valid) {
      return err(domainError("VALIDATION", validacao.errors.join(" ")));
    }
    try {
      const r = await upsertTabela({
        userId: ctx.user.id,
        tipo: "global",
        categoriaId: null,
        nome: nome ?? "Tabela Global",
        faixas: novas,
        usarValorFixoPacote,
      });
      return ok({
        id: r.id,
        diff: diffFaixas(r.anterior?.faixas ?? null, novas),
        aviso: AVISO_CONGELAMENTO,
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

export const upsertTabelaCategoriaCap = defineCommand({
  id: "precificacao.upsertTabelaCategoria",
  title: "Atualizar tabela de foto extra de uma categoria",
  description:
    "Substitui as faixas progressivas de fotos extras de uma categoria específica. Requer aprovação.",
  input: z
    .object({
      categoriaId: z.string(),
      nome: z.string().max(80).optional(),
      faixas: z.array(FaixaSchema).min(1),
      usarValorFixoPacote: z.boolean().default(false),
    })
    .strict(),
  output: z.object({
    id: z.string(),
    categoriaId: z.string(),
    diff: DiffSchema,
    aviso: z.string(),
  }),
  permissions: [],
  sideEffects: ["db:tabelas_precos"],
  handler: async ({ categoriaId, nome, faixas, usarValorFixoPacote }, ctx) => {
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));
    const novas = faixas as unknown as FaixaPreco[];
    const validacao = validarFaixas(novas);
    if (!validacao.valid) {
      return err(domainError("VALIDATION", validacao.errors.join(" ")));
    }

    const { data: cat, error: catErr } = await supabase
      .from("categorias")
      .select("id, nome")
      .eq("id", categoriaId)
      .maybeSingle();
    if (catErr) return err(domainError("DB", catErr.message));
    if (!cat) return err(domainError("NOT_FOUND", "Categoria não encontrada."));

    try {
      const r = await upsertTabela({
        userId: ctx.user.id,
        tipo: "categoria",
        categoriaId,
        nome: nome ?? `Tabela ${cat.nome}`,
        faixas: novas,
        usarValorFixoPacote,
      });
      return ok({
        id: r.id,
        categoriaId,
        diff: diffFaixas(r.anterior?.faixas ?? null, novas),
        aviso: AVISO_CONGELAMENTO,
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});
