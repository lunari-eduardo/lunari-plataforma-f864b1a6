import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.vendas.metasProgresso`
 *
 * Cruza as metas configuradas (pricing_configuracoes + metas_personalizadas)
 * com o realizado do ano (RPC `sales_analytics_summary`) e devolve progresso,
 * gap em reais e ritmo mensal necessário.
 */

const Input = z.object({
  ano: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12).nullable().optional(),
});

const Output = z.object({
  ano: z.number(),
  anual: z.any(),
  mensal: z.any().nullable(),
  porCategoria: z.array(z.any()),
});

export const vendasMetasProgresso = defineQuery({
  id: "workflow.vendas.metasProgresso",
  title: "Progresso das metas de vendas",
  description:
    "Compara as metas configuradas (anual, mensal e por categoria) com o realizado do ano: percentual atingido, quanto falta e ritmo mensal necessário para bater a meta.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ ano, mes }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const [resumoRes, configRes, metasRes] = await Promise.all([
      supabase.rpc("sales_analytics_summary", {
        p_user_id: userId,
        p_year: ano,
        p_month: null,
        p_categoria: null,
      } as never),
      supabase
        .from("pricing_configuracoes")
        .select("ano_meta, meta_faturamento_anual, usar_metas_personalizadas, modo_metas")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("metas_personalizadas")
        .select("ano, mes, categoria, meta_faturamento, meta_lucro")
        .eq("user_id", userId)
        .eq("ano", ano),
    ]);

    if (resumoRes.error) {
      ctx.log.error("falha ao ler realizado para metas", { cause: resumoRes.error });
      return err(domainError("EXTERNAL", "Não foi possível ler o realizado do ano.", { retriable: true }));
    }

    const resumo = resumoRes.data as never as {
      totais: { receita_realizada: number };
      porMes: Array<{ mes: number; receita: number }>;
      porCategoria: Array<{ categoria: string; receita: number }>;
    };

    const num = (v: unknown) => Number(v) || 0;
    const realizadoAno = num(resumo?.totais?.receita_realizada);
    const metas = (metasRes.data ?? []) as Array<{
      mes: number | null;
      categoria: string | null;
      meta_faturamento: number | null;
    }>;

    const metaAnualPersonalizada = metas.find((m) => !m.mes && !m.categoria)?.meta_faturamento;
    const metaAnual = num(metaAnualPersonalizada ?? configRes.data?.meta_faturamento_anual);

    const mesRef = mes ?? new Date().getMonth() + 1;
    const realizadoMes = num(resumo?.porMes?.find((m) => Number(m.mes) === mesRef)?.receita);
    const metaMesRow = metas.find((m) => Number(m.mes) === mesRef && !m.categoria)?.meta_faturamento;
    const metaMes = num(metaMesRow ?? (metaAnual > 0 ? metaAnual / 12 : 0));

    const mesesRestantes = Math.max(12 - mesRef + 1, 1);
    const gapAnual = Math.max(metaAnual - realizadoAno, 0);

    const porCategoria = metas
      .filter((m) => !!m.categoria)
      .map((m) => {
        const meta = num(m.meta_faturamento);
        const realizado = num(
          resumo?.porCategoria?.find(
            (c) => String(c.categoria).toLowerCase() === String(m.categoria).toLowerCase(),
          )?.receita,
        );
        return {
          categoria: m.categoria,
          meta,
          realizado,
          progressoPercentual: meta > 0 ? Number(((realizado / meta) * 100).toFixed(2)) : null,
          falta: Math.max(meta - realizado, 0),
        };
      });

    return ok({
      ano,
      anual: {
        meta: metaAnual,
        realizado: realizadoAno,
        progressoPercentual: metaAnual > 0 ? Number(((realizadoAno / metaAnual) * 100).toFixed(2)) : null,
        falta: gapAnual,
        ritmoMensalNecessario: Number((gapAnual / mesesRestantes).toFixed(2)),
        mesesRestantes,
        origem: metaAnualPersonalizada != null ? "metas_personalizadas" : "precificacao",
      },
      mensal: {
        mes: mesRef,
        meta: metaMes,
        realizado: realizadoMes,
        progressoPercentual: metaMes > 0 ? Number(((realizadoMes / metaMes) * 100).toFixed(2)) : null,
        falta: Math.max(metaMes - realizadoMes, 0),
      },
      porCategoria,
    } as never);
  },
});
