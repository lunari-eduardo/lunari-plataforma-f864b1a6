import { supabase } from "@/integrations/supabase/client";
import type { PadraoHoras, MetasPrecificacao } from "@/types/precificacao";

export function createDefaultPadraoHoras(userId?: string | null): PadraoHoras {
  return {
    horasDisponiveis: 8,
    diasTrabalhados: 5,
    user_id: userId || undefined,
    created_at: new Date().toISOString(),
  };
}

export async function savePadraoHoras(userId: string, dados: PadraoHoras): Promise<boolean> {
  try {
    const { error } = await supabase.from("pricing_configuracoes").upsert(
      {
        user_id: userId,
        horas_disponiveis: dados.horasDisponiveis,
        dias_trabalhados: dados.diasTrabalhados,
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;

    console.log("✅ Padrão de horas salvo no Supabase");
    return true;
  } catch (error) {
    console.error("❌ Erro ao salvar padrão de horas:", error);
    return false;
  }
}

export async function loadPadraoHoras(userId: string): Promise<PadraoHoras> {
  try {
    const { data } = await supabase
      .from("pricing_configuracoes")
      .select("horas_disponiveis, dias_trabalhados, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      horasDisponiveis: data?.horas_disponiveis || 8,
      diasTrabalhados: data?.dias_trabalhados || 5,
      user_id: userId,
      created_at: data?.created_at,
      updated_at: data?.updated_at,
    };
  } catch (error) {
    console.error("❌ Erro ao carregar padrão de horas:", error);
    return createDefaultPadraoHoras(userId);
  }
}

export function createDefaultMetas(userId?: string | null): MetasPrecificacao {
  const currentYear = new Date().getFullYear();
  return {
    margemLucroDesejada: 30,
    ano: currentYear,
    metaFaturamentoAnual: 0,
    metaLucroAnual: 0,
    user_id: userId || undefined,
    created_at: new Date().toISOString(),
  };
}

export async function saveMetas(userId: string, dados: MetasPrecificacao): Promise<boolean> {
  try {
    const { error } = await supabase.from("pricing_configuracoes").upsert(
      {
        user_id: userId,
        margem_lucro_desejada: dados.margemLucroDesejada,
        ano_meta: dados.ano,
        meta_faturamento_anual: dados.metaFaturamentoAnual,
        meta_lucro_anual: dados.metaLucroAnual,
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;

    console.log("✅ Metas salvas no Supabase");
    return true;
  } catch (error) {
    console.error("❌ Erro ao salvar metas:", error);
    return false;
  }
}

export async function loadMetas(userId: string): Promise<MetasPrecificacao> {
  try {
    const currentYear = new Date().getFullYear();

    const { data } = await supabase
      .from("pricing_configuracoes")
      .select(
        "margem_lucro_desejada, ano_meta, meta_faturamento_anual, meta_lucro_anual, created_at, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle();

    return {
      margemLucroDesejada: data?.margem_lucro_desejada || 30,
      ano: data?.ano_meta || currentYear,
      metaFaturamentoAnual: data?.meta_faturamento_anual || 0,
      metaLucroAnual: data?.meta_lucro_anual || 0,
      user_id: userId,
      created_at: data?.created_at,
      updated_at: data?.updated_at,
    };
  } catch (error) {
    console.error("❌ Erro ao carregar metas:", error);
    return createDefaultMetas(userId);
  }
}
