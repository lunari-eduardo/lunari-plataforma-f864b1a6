/**
 * Capabilities de ESCRITA — módulo Precificação (Bloco B2).
 *
 * TODA escrita aqui altera o preço praticado pelo estúdio e exige aprovação
 * humana (ver `ai/permissions.ts`). Regras invioláveis:
 *
 *  1. Validação de domínio acontece ANTES do gate — faixa inválida falha sem
 *     consumir aprovação.
 *  2. A resposta traz o diff (antes → depois) para conferência.
 *  3. Nada aqui toca `regras_congeladas` de sessões existentes: alterar preço
 *     vale só para sessões NOVAS.
 *  4. RLS por `user_id` — nenhuma query filtra usuário manualmente.
 */
import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";
import { round2, validarFaixas } from "../domain/calculo";
import type { Json } from "@/integrations/supabase/types";
import type { FaixaPreco } from "../domain/types";
import { FaixaSchema, loadModelo, loadTabelas } from "./leitura";

const AVISO_CONGELAMENTO =
  "Alteração vale apenas para sessões novas — sessões existentes mantêm as regras de preço congeladas.";

const DiffSchema = z.array(
  z.object({ campo: z.string(), de: z.string(), para: z.string() }),
);

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

/* ============================== PACOTE ============================== */

export const updatePacotePrecoCap = defineCommand({
  id: "precificacao.updatePacotePreco",
  title: "Alterar preço de um pacote",
  description:
    "Atualiza valor base, valor da foto extra e/ou fotos incluídas de um pacote. Requer aprovação.",
  input: z
    .object({
      pacoteId: z.string(),
      valorBase: z.number().nonnegative().optional(),
      valorFotoExtra: z.number().nonnegative().optional(),
      fotosIncluidas: z.number().int().nonnegative().optional(),
    })
    .strict(),
  output: z.object({
    id: z.string(),
    nome: z.string(),
    diff: DiffSchema,
    aviso: z.string(),
  }),
  permissions: [],
  sideEffects: ["db:pacotes"],
  handler: async ({ pacoteId, valorBase, valorFotoExtra, fotosIncluidas }) => {
    if (valorBase === undefined && valorFotoExtra === undefined && fotosIncluidas === undefined) {
      return err(domainError("VALIDATION", "Informe ao menos um valor para alterar."));
    }

    const { data: atual, error: readErr } = await supabase
      .from("pacotes")
      .select("id, nome, valor_base, valor_foto_extra, fotos_incluidas")
      .eq("id", pacoteId)
      .maybeSingle();
    if (readErr) return err(domainError("DB", readErr.message));
    if (!atual) return err(domainError("NOT_FOUND", "Pacote não encontrado."));

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const diff: Array<{ campo: string; de: string; para: string }> = [];

    if (valorBase !== undefined) {
      patch.valor_base = valorBase;
      diff.push({
        campo: "Valor base",
        de: String(round2(Number(atual.valor_base) || 0)),
        para: String(round2(valorBase)),
      });
    }
    if (valorFotoExtra !== undefined) {
      patch.valor_foto_extra = valorFotoExtra;
      diff.push({
        campo: "Valor foto extra",
        de: String(round2(Number(atual.valor_foto_extra) || 0)),
        para: String(round2(valorFotoExtra)),
      });
    }
    if (fotosIncluidas !== undefined) {
      patch.fotos_incluidas = fotosIncluidas;
      diff.push({
        campo: "Fotos incluídas",
        de: String(Number(atual.fotos_incluidas) || 0),
        para: String(fotosIncluidas),
      });
    }

    const { error } = await supabase.from("pacotes").update(patch).eq("id", pacoteId);
    if (error) return err(domainError("DB", error.message));

    return ok({
      id: atual.id as string,
      nome: (atual.nome as string) ?? "",
      diff,
      aviso: AVISO_CONGELAMENTO,
    });
  },
});

/* ======================= MARGEM / HORAS / METAS ======================= */

async function ensurePricingConfigId(userId: string): Promise<string> {
  const { data } = await supabase.from("pricing_configuracoes").select("id").maybeSingle();
  if (data?.id) return data.id as string;
  const { data: created, error } = await supabase
    .from("pricing_configuracoes")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export const updateMargemEHorasCap = defineCommand({
  id: "precificacao.updateMargemEHoras",
  title: "Alterar margem, horas e pró-labore",
  description:
    "Atualiza margem de lucro desejada, horas produtivas por dia, dias trabalhados por semana e percentual de pró-labore. Muda o custo por hora de todas as simulações. Requer aprovação.",
  input: z
    .object({
      margemLucroDesejada: z.number().min(0).max(100).optional(),
      horasDisponiveis: z.number().int().min(1).max(24).optional(),
      diasTrabalhados: z.number().int().min(1).max(7).optional(),
      percentualProLabore: z.number().min(0).max(500).optional(),
    })
    .strict(),
  output: z.object({ diff: DiffSchema, aviso: z.string() }),
  permissions: [],
  sideEffects: ["db:pricing_configuracoes"],
  handler: async (input, ctx) => {
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));
    const keys = Object.values(input).filter((v) => v !== undefined);
    if (keys.length === 0) {
      return err(domainError("VALIDATION", "Informe ao menos um campo para alterar."));
    }

    try {
      const { data: atual } = await supabase
        .from("pricing_configuracoes")
        .select(
          "id, margem_lucro_desejada, horas_disponiveis, dias_trabalhados, percentual_pro_labore",
        )
        .maybeSingle();

      const id = atual?.id ?? (await ensurePricingConfigId(ctx.user.id));
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const diff: Array<{ campo: string; de: string; para: string }> = [];

      const map: Array<[keyof typeof input, string, string]> = [
        ["margemLucroDesejada", "margem_lucro_desejada", "Margem de lucro (%)"],
        ["horasDisponiveis", "horas_disponiveis", "Horas por dia"],
        ["diasTrabalhados", "dias_trabalhados", "Dias por semana"],
        ["percentualProLabore", "percentual_pro_labore", "Pró-labore (%)"],
      ];

      for (const [inKey, col, label] of map) {
        const v = input[inKey];
        if (v === undefined) continue;
        patch[col] = v;
        diff.push({
          campo: label,
          de: String(atual?.[col as keyof typeof atual] ?? "—"),
          para: String(v),
        });
      }

      const { error } = await supabase.from("pricing_configuracoes").update(patch).eq("id", id);
      if (error) return err(domainError("DB", error.message));

      return ok({
        diff,
        aviso: "Isto recalcula o custo por hora usado em todas as simulações futuras.",
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

export const setMetasCap = defineCommand({
  id: "precificacao.setMetas",
  title: "Definir metas de faturamento e lucro",
  description:
    "Define as metas anuais de faturamento e lucro e, opcionalmente, uma meta personalizada de um mês/categoria. Requer aprovação.",
  input: z
    .object({
      ano: z.number().int().min(2020).max(2100),
      metaFaturamentoAnual: z.number().nonnegative().optional(),
      metaLucroAnual: z.number().nonnegative().optional(),
      usarMetasPersonalizadas: z.boolean().optional(),
      personalizada: z
        .object({
          mes: z.number().int().min(1).max(12),
          categoria: z.string().nullable().optional(),
          metaFaturamento: z.number().nonnegative(),
          metaLucro: z.number().nonnegative(),
        })
        .optional(),
    })
    .strict(),
  output: z.object({ diff: DiffSchema, aviso: z.string() }),
  permissions: [],
  sideEffects: ["db:pricing_configuracoes", "db:metas_personalizadas"],
  handler: async (input, ctx) => {
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));

    try {
      const { data: atual } = await supabase
        .from("pricing_configuracoes")
        .select(
          "id, ano_meta, meta_faturamento_anual, meta_lucro_anual, usar_metas_personalizadas",
        )
        .maybeSingle();
      const id = atual?.id ?? (await ensurePricingConfigId(ctx.user.id));

      const patch: Record<string, unknown> = {
        ano_meta: input.ano,
        updated_at: new Date().toISOString(),
      };
      const diff: Array<{ campo: string; de: string; para: string }> = [
        { campo: "Ano da meta", de: String(atual?.ano_meta ?? "—"), para: String(input.ano) },
      ];

      if (input.metaFaturamentoAnual !== undefined) {
        patch.meta_faturamento_anual = input.metaFaturamentoAnual;
        diff.push({
          campo: "Meta de faturamento anual",
          de: String(atual?.meta_faturamento_anual ?? 0),
          para: String(input.metaFaturamentoAnual),
        });
      }
      if (input.metaLucroAnual !== undefined) {
        patch.meta_lucro_anual = input.metaLucroAnual;
        diff.push({
          campo: "Meta de lucro anual",
          de: String(atual?.meta_lucro_anual ?? 0),
          para: String(input.metaLucroAnual),
        });
      }
      if (input.usarMetasPersonalizadas !== undefined) {
        patch.usar_metas_personalizadas = input.usarMetasPersonalizadas;
        diff.push({
          campo: "Usar metas personalizadas",
          de: String(Boolean(atual?.usar_metas_personalizadas)),
          para: String(input.usarMetasPersonalizadas),
        });
      }

      const { error } = await supabase.from("pricing_configuracoes").update(patch).eq("id", id);
      if (error) return err(domainError("DB", error.message));

      if (input.personalizada) {
        const p = input.personalizada;
        const { data: existente } = await supabase
          .from("metas_personalizadas")
          .select("id, meta_faturamento, meta_lucro")
          .eq("ano", input.ano)
          .eq("mes", p.mes)
          .maybeSingle();

        if (existente?.id) {
          const { error: upErr } = await supabase
            .from("metas_personalizadas")
            .update({
              meta_faturamento: p.metaFaturamento,
              meta_lucro: p.metaLucro,
              categoria: p.categoria ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existente.id);
          if (upErr) return err(domainError("DB", upErr.message));
        } else {
          const { error: insErr } = await supabase.from("metas_personalizadas").insert({
            user_id: ctx.user.id,
            ano: input.ano,
            mes: p.mes,
            categoria: p.categoria ?? null,
            meta_faturamento: p.metaFaturamento,
            meta_lucro: p.metaLucro,
          });
          if (insErr) return err(domainError("DB", insErr.message));
        }

        diff.push({
          campo: `Meta ${String(p.mes).padStart(2, "0")}/${input.ano}`,
          de: String(existente?.meta_faturamento ?? 0),
          para: String(p.metaFaturamento),
        });
      }

      return ok({ diff, aviso: "Metas alteradas afetam os painéis de análise de vendas." });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});
