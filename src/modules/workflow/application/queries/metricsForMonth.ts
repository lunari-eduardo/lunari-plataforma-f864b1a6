import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { sessionsRepo } from "@/features/workflow/data";

/**
 * Capability `workflow.metricsForMonth`
 *
 * Métricas agregadas do mês: previsto, recebido, restante e contagem de
 * sessões. Retorna **números** (centavos), nunca strings de moeda — a UI
 * formata. Substitui os 3 hooks paralelos de métricas (legados).
 */

const Input = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

const Output = z.object({
  year: z.number(),
  month: z.number(),
  previstoCentavos: z.number(),
  recebidoCentavos: z.number(),
  restanteCentavos: z.number(),
  sessoes: z.number(),
  pagas: z.number(),
  pendentes: z.number(),
});

export const metricsForMonth = defineQuery({
  id: "workflow.metricsForMonth",
  title: "Métricas do mês (Workflow)",
  description:
    "Calcula previsto/recebido/restante a partir das sessões do mês (centavos).",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ year, month }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    let rows;
    try {
      rows = await sessionsRepo.listByMonth(userId, year, month);
    } catch (cause) {
      ctx.log.error("falha ao calcular métricas do mês", { cause });
      return err(
        domainError("EXTERNAL", "Não foi possível calcular as métricas.", {
          retriable: true,
          cause,
        }),
      );
    }

    let previsto = 0;
    let recebido = 0;
    let pagas = 0;
    let pendentes = 0;

    for (const s of rows as any[]) {
      const total = Number(s.valor_total ?? 0);
      const pago = Number(s.valor_pago ?? 0);
      previsto += total;
      recebido += pago;
      if (pago > 0 && pago >= total && total > 0) pagas += 1;
      else if (total > 0) pendentes += 1;
    }

    const toCents = (v: number) => Math.round(v * 100);

    return ok({
      year,
      month,
      previstoCentavos: toCents(previsto),
      recebidoCentavos: toCents(recebido),
      restanteCentavos: Math.max(0, toCents(previsto) - toCents(recebido)),
      sessoes: rows.length,
      pagas,
      pendentes,
    });
  },
});
