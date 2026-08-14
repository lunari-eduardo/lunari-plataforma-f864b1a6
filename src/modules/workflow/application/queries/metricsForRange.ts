import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.metricsForRange`
 *
 * Métricas do Workflow para um intervalo arbitrário, agrupadas por
 * granularidade (day/month/quarter/year/total). Valores em centavos.
 */

const DateStr = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  const str = val.trim();
  const brDateMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brDateMatch) {
    const [_, d, m, y] = brDateMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const isoLikeMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoLikeMatch) {
    const [_, y, m, d] = isoLikeMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return str;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "esperado YYYY-MM-DD"));

const Input = z.object({
  startDate: DateStr,
  endDate: DateStr,
  granularity: z.enum(["day", "month", "quarter", "year", "total"]).default("month"),
  includeHistorico: z.boolean().optional().default(false),
});

const Bucket = z.object({
  key: z.string(),
  bucketStart: z.string(),
  previstoCentavos: z.number(),
  recebidoCentavos: z.number(),
  restanteCentavos: z.number(),
  creditosGeradosCentavos: z.number(),
  creditosUtilizadosCentavos: z.number(),
  caixaRecebidoCentavos: z.number(),
  sessoes: z.number(),
});

const Output = z.object({
  range: z.object({ start: z.string(), end: z.string() }),
  granularity: z.string(),
  buckets: z.array(Bucket),
  total: z.object({
    previstoCentavos: z.number(),
    recebidoCentavos: z.number(),
    restanteCentavos: z.number(),
    creditosGeradosCentavos: z.number(),
    creditosUtilizadosCentavos: z.number(),
    caixaRecebidoCentavos: z.number(),
    sessoes: z.number(),
  }),
});

const toCents = (v: unknown) => Math.round((Number(v) || 0) * 100);

export const metricsForRange = defineQuery({
  id: "workflow.metricsForRange",
  title: "Métricas do Workflow (intervalo)",
  description:
    "Agrega métricas do Workflow num intervalo (até 400 dias) por dia/mês/trimestre/ano/total. Valores em centavos.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ startDate, endDate, granularity, includeHistorico }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const { data, error } = await supabase.rpc("workflow_range_metrics", {
      p_user_id: userId,
      p_start: startDate,
      p_end: endDate,
      p_granularity: granularity,
      p_include_historico: includeHistorico,
    } as any);

    if (error) {
      ctx.log.error("falha ao calcular métricas do intervalo", { cause: error });
      return err(
        domainError("EXTERNAL", "Não foi possível calcular as métricas.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const buckets = rows.map((r: any) => ({
      key: String(r.bucket_key),
      bucketStart: String(r.bucket_start),
      previstoCentavos: toCents(r.previsto),
      recebidoCentavos: toCents(r.receita),
      restanteCentavos: toCents(r.pendente),
      creditosGeradosCentavos: toCents(r.creditos_gerados),
      creditosUtilizadosCentavos: toCents(r.creditos_utilizados),
      caixaRecebidoCentavos: toCents(r.caixa_recebido),
      sessoes: Number(r.sessoes) || 0,
    }));

    const total = buckets.reduce(
      (acc, b) => ({
        previstoCentavos: acc.previstoCentavos + b.previstoCentavos,
        recebidoCentavos: acc.recebidoCentavos + b.recebidoCentavos,
        restanteCentavos: acc.restanteCentavos + b.restanteCentavos,
        creditosGeradosCentavos: acc.creditosGeradosCentavos + b.creditosGeradosCentavos,
        creditosUtilizadosCentavos: acc.creditosUtilizadosCentavos + b.creditosUtilizadosCentavos,
        caixaRecebidoCentavos: acc.caixaRecebidoCentavos + b.caixaRecebidoCentavos,
        sessoes: acc.sessoes + b.sessoes,
      }),
      {
        previstoCentavos: 0,
        recebidoCentavos: 0,
        restanteCentavos: 0,
        creditosGeradosCentavos: 0,
        creditosUtilizadosCentavos: 0,
        caixaRecebidoCentavos: 0,
        sessoes: 0,
      },
    );

    return ok({
      range: { start: startDate, end: endDate },
      granularity,
      buckets,
      total,
    });
  },
});
