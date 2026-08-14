import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.analytics.summary`
 *
 * Relatório estratégico one-shot: totais + quebras por mês, categoria,
 * pacote, status e top 20 clientes. Delegado a um único RPC no Postgres.
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
  includeHistorico: z.boolean().optional().default(false),
});

const Output = z.object({
  range: z.object({
    start: z.string(),
    end: z.string(),
    includeHistorico: z.boolean(),
  }),
  totals: z.object({
    previsto: z.number(),
    receita: z.number(),
    pendente: z.number(),
    sessoes: z.number(),
    ticket_medio: z.number(),
  }),
  porMes: z.array(z.any()),
  porCategoria: z.array(z.any()),
  porPacote: z.array(z.any()),
  porStatus: z.array(z.any()),
  topClientes: z.array(z.any()),
});

export const analyticsSummary = defineQuery({
  id: "workflow.analytics.summary",
  title: "Resumo analítico do Workflow",
  description:
    "Relatório estratégico (totais + quebras por mês/categoria/pacote/status + top 20 clientes) para um intervalo (máx 400 dias). Ideal para o assistente responder a pedidos de análise em uma única chamada.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ startDate, endDate, includeHistorico }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const { data, error } = await supabase.rpc("workflow_analytics_summary", {
      p_user_id: userId,
      p_start: startDate,
      p_end: endDate,
      p_include_historico: includeHistorico,
    } as any);

    if (error) {
      ctx.log.error("falha ao gerar resumo analítico", { cause: error });
      return err(
        domainError("EXTERNAL", "Não foi possível gerar o resumo analítico.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    return ok(data as any);
  },
});
