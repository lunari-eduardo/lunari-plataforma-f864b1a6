import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.photoProductionForYear`
 *
 * Consolidado anual de produção fotográfica + série mensal, reaproveitando o
 * RPC mensal `workflow_photo_production_month` mês a mês.
 */

const Input = z.object({
  year: z.number().int().min(2000).max(2100),
  categoria: z.string().min(1).nullable().optional(),
});

const Output = z.object({
  year: z.number(),
  total: z.any(),
  porMes: z.array(z.any()),
});

export const photoProductionForYear = defineQuery({
  id: "workflow.photoProductionForYear",
  title: "Produção fotográfica do ano",
  description:
    "Total de fotos do ano (incluídas + extras), média por sessão, categoria líder e série mês a mês.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ year, categoria }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const n = (v: unknown) => Number(v) || 0;
    const meses = Array.from({ length: 12 }, (_, i) => i + 1);

    const results = await Promise.all(
      meses.map(async (month) => {
        const mm = String(month).padStart(2, "0");
        const lastDay = new Date(year, month, 0).getDate();
        const { data, error } = await supabase.rpc("workflow_photo_production_month", {
          p_user_id: userId,
          p_start: `${year}-${mm}-01`,
          p_end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
          p_categoria: categoria ?? null,
        });
        if (error) throw error;
        const row: never = (Array.isArray(data) ? data[0] : data) as never;
        const r = (row ?? {}) as Record<string, unknown>;
        return {
          mes: month,
          fotosIncluidas: Math.round(n(r.fotos_incluidas)),
          fotosExtras: Math.round(n(r.fotos_extras)),
          fotosTotal: Math.round(n(r.fotos_total)),
          sessoesComPacote: Math.round(n(r.sessoes_com_pacote)),
          sessoesSemPacote: Math.round(n(r.sessoes_sem_pacote)),
          categoriaTop: (r.categoria_top ?? null) as string | null,
          fotosCategoriaTop: Math.round(n(r.fotos_categoria_top)),
        };
      }),
    ).catch((e) => {
      ctx.log.error("falha na produção fotográfica anual", { cause: e });
      return null;
    });

    if (!results) {
      return err(
        domainError("EXTERNAL", "Não foi possível calcular a produção fotográfica do ano.", {
          retriable: true,
        }),
      );
    }

    const soma = (k: "fotosIncluidas" | "fotosExtras" | "fotosTotal" | "sessoesComPacote" | "sessoesSemPacote") =>
      results.reduce((acc, m) => acc + m[k], 0);

    const sessoes = soma("sessoesComPacote") + soma("sessoesSemPacote");
    const porCategoria = new Map<string, number>();
    for (const m of results) {
      if (m.categoriaTop) porCategoria.set(m.categoriaTop, (porCategoria.get(m.categoriaTop) ?? 0) + m.fotosCategoriaTop);
    }
    const top = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    return ok({
      year,
      total: {
        fotosIncluidas: soma("fotosIncluidas"),
        fotosExtras: soma("fotosExtras"),
        fotosTotal: soma("fotosTotal"),
        sessoes,
        mediaFotosPorSessao: sessoes > 0 ? Number((soma("fotosTotal") / sessoes).toFixed(2)) : 0,
        categoriaTop: top?.[0] ?? null,
        fotosCategoriaTop: top?.[1] ?? 0,
      },
      porMes: results,
    } as never);
  },
});
