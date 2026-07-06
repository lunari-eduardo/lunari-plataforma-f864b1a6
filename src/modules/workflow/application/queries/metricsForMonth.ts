import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.metricsForMonth`
 *
 * Fonte canônica: RPC `workflow_month_metrics`. Retorna valores em
 * **centavos** (a UI formata). Elimina dupla contagem com créditos porque
 * a receita é limitada ao valor da sessão.
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
  creditosGeradosCentavos: z.number(),
  creditosUtilizadosCentavos: z.number(),
  caixaRecebidoCentavos: z.number(),
  sessoes: z.number(),
});

export const metricsForMonth = defineQuery({
  id: "workflow.metricsForMonth",
  title: "Métricas do mês (Workflow)",
  description:
    "Calcula previsto/receita/pendente/créditos/caixa a partir do RPC canônico (centavos).",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ year, month }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data, error } = await supabase.rpc("workflow_month_metrics", {
      p_user_id: userId,
      p_start: start,
      p_end: end,
    });

    if (error) {
      ctx.log.error("falha ao calcular métricas do mês", { cause: error });
      return err(
        domainError("EXTERNAL", "Não foi possível calcular as métricas.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const row: any = Array.isArray(data) ? data[0] : data;
    const toCents = (v: unknown) => Math.round((Number(v) || 0) * 100);

    return ok({
      year,
      month,
      previstoCentavos: toCents(row?.previsto),
      recebidoCentavos: toCents(row?.receita),
      restanteCentavos: toCents(row?.pendente),
      creditosGeradosCentavos: toCents(row?.creditos_gerados),
      creditosUtilizadosCentavos: toCents(row?.creditos_utilizados),
      caixaRecebidoCentavos: toCents(row?.caixa_recebido),
      sessoes: Number(row?.sessoes) || 0,
    });
  },
});
