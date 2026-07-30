import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.vendas.compararAnos`
 *
 * Comparativo ano contra ano em período equivalente (mesmo mês-limite),
 * igual ao comportamento da página Análise de Vendas.
 * Fonte canônica: RPC `sales_analytics_compare`.
 */

const Input = z.object({
  anoBase: z.number().int().min(2000).max(2100),
  anoComparacao: z.number().int().min(2000).max(2100),
  limiteMes: z.number().int().min(1).max(12).nullable().optional(),
  categoria: z.string().min(1).nullable().optional(),
});

const Output = z.object({
  anoBase: z.number(),
  anoComparacao: z.number(),
  limiteMes: z.number(),
  base: z.any(),
  comparacao: z.any(),
  variacaoPercentual: z.any(),
  porMes: z.array(z.any()),
});

export const vendasCompararAnos = defineQuery({
  id: "workflow.vendas.compararAnos",
  title: "Comparativo de vendas ano a ano",
  description:
    "Compara dois anos no mesmo período (mês-limite automático quando o ano base é o corrente): receita, sessões, ticket médio e fotos extras, com variação percentual e série mensal lado a lado.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ anoBase, anoComparacao, limiteMes, categoria }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const { data, error } = await supabase.rpc("sales_analytics_compare", {
      p_user_id: userId,
      p_ano_base: anoBase,
      p_ano_comparacao: anoComparacao,
      p_limite_mes: limiteMes ?? null,
      p_categoria: categoria ?? null,
    } as never);

    if (error) {
      ctx.log.error("falha ao comparar anos de vendas", { cause: error });
      return err(
        domainError("EXTERNAL", "Não foi possível comparar os anos.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    return ok(data as never);
  },
});
