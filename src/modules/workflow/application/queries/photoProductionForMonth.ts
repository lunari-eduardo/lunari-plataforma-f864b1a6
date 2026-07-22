import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { photoProductionCache } from "@/features/workflow/data/photoProductionCache";

/**
 * Capability `workflow.photoProductionForMonth`
 *
 * Fonte canônica: RPC `workflow_photo_production_month`.
 * Retorna quantidades absolutas de fotos (não centavos, não moeda).
 * Serve como métrica operacional de produção — quantas fotos devem ser
 * editadas / entregues no mês.
 */

const Input = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  categoria: z.string().min(1).nullable().optional(),
});

const Output = z.object({
  year: z.number(),
  month: z.number(),
  fotosIncluidas: z.number(),
  fotosExtras: z.number(),
  fotosTotal: z.number(),
  sessoesComPacote: z.number(),
  sessoesSemPacote: z.number(),
  mediaFotosPorSessao: z.number(),
  categoriaTop: z.string().nullable(),
  fotosCategoriaTop: z.number(),
});

export const photoProductionForMonth = defineQuery({
  id: "workflow.photoProductionForMonth",
  title: "Produção fotográfica do mês",
  description:
    "Total de fotos previstas para produção no mês (incluídas no pacote + extras), com quebra por categoria.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ year, month, categoria }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data, error } = await supabase.rpc("workflow_photo_production_month", {
      p_user_id: userId,
      p_start: start,
      p_end: end,
      p_categoria: categoria ?? null,
    });

    if (error) {
      ctx.log.error("falha ao calcular produção fotográfica", { cause: error });
      return err(
        domainError("EXTERNAL", "Não foi possível calcular a produção fotográfica.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const row: any = Array.isArray(data) ? data[0] : data;
    const n = (v: unknown) => Number(v) || 0;

    const parsed = {
      year,
      month,
      fotosIncluidas: Math.round(n(row?.fotos_incluidas)),
      fotosExtras: Math.round(n(row?.fotos_extras)),
      fotosTotal: Math.round(n(row?.fotos_total)),
      sessoesComPacote: Math.round(n(row?.sessoes_com_pacote)),
      sessoesSemPacote: Math.round(n(row?.sessoes_sem_pacote)),
      mediaFotosPorSessao: n(row?.media_fotos_por_sessao),
      categoriaTop: (row?.categoria_top ?? null) as string | null,
      fotosCategoriaTop: Math.round(n(row?.fotos_categoria_top)),
    };

    photoProductionCache.set(userId, year, month, {
      fotosIncluidas: parsed.fotosIncluidas,
      fotosExtras: parsed.fotosExtras,
      fotosTotal: parsed.fotosTotal,
      sessoesComPacote: parsed.sessoesComPacote,
      sessoesSemPacote: parsed.sessoesSemPacote,
      mediaFotosPorSessao: parsed.mediaFotosPorSessao,
      categoriaTop: parsed.categoriaTop,
      fotosCategoriaTop: parsed.fotosCategoriaTop,
    }, categoria ?? null);

    return ok(parsed);
  },
});
