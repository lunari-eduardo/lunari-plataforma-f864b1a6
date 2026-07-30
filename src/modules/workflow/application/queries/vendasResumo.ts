import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.vendas.resumo`
 *
 * Espelha, no servidor, exatamente o regime da página Análise de Vendas:
 * inclui vendas avulsas e sessões em histórico, exclui apenas canceladas.
 * Fonte canônica: RPC `sales_analytics_summary`.
 */

const Input = z.object({
  ano: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12).nullable().optional(),
  categoria: z.string().min(1).nullable().optional(),
});

const Output = z.object({
  filtros: z.any(),
  totais: z.any(),
  porMes: z.array(z.any()),
  porCategoria: z.array(z.any()),
  porPacote: z.array(z.any()),
  porOrigem: z.array(z.any()),
  anosDisponiveis: z.array(z.any()),
  categoriasDisponiveis: z.array(z.any()),
});

export const vendasResumo = defineQuery({
  id: "workflow.vendas.resumo",
  title: "Resumo de Análise de Vendas",
  description:
    "Métricas da página Análise de Vendas para um ano (opcionalmente mês e categoria): receita realizada e prevista, pendente, ticket médio, desconto, fotos extras, valor adicional, clientes únicos, série mensal e quebras por categoria, pacote e origem do lead.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ ano, mes, categoria }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const { data, error } = await supabase.rpc("sales_analytics_summary", {
      p_user_id: userId,
      p_year: ano,
      p_month: mes ?? null,
      p_categoria: categoria ?? null,
    } as never);

    if (error) {
      ctx.log.error("falha ao gerar resumo de vendas", { cause: error });
      return err(
        domainError("EXTERNAL", "Não foi possível gerar o resumo de vendas.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    return ok(data as never);
  },
});
