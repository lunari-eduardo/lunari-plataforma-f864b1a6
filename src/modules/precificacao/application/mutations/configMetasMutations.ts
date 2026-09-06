import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";
import { DiffSchema, ensurePricingConfigId } from "./common";

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
