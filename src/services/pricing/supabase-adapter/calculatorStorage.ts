import { supabase } from "@/integrations/supabase/client";
import type { EstadoCalculadora } from "@/types/precificacao";

export async function saveCalculadora(userId: string, dados: EstadoCalculadora): Promise<boolean> {
  try {
    // Primeiro, buscar ou criar registro default
    const { data: existente } = await supabase
      .from("pricing_calculadora_estados")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();

    const calculadoraId = existente?.id || dados.id || crypto.randomUUID();

    // Se existe, update. Se não, insert
    if (existente?.id) {
      const { error } = await supabase
        .from("pricing_calculadora_estados")
        .update({
          nome: dados.nome || "Estado padrão",
          horas_estimadas: dados.horasEstimadas,
          markup: dados.markup,
          produtos: JSON.stringify(dados.produtos),
          custos_extras: JSON.stringify(dados.custosExtras),
          custo_total_calculado: dados.custoTotalCalculado,
          preco_final_calculado: dados.precoFinalCalculado,
          lucratividade: dados.lucratividade,
        })
        .eq("id", existente.id);

      if (error) throw error;
    } else {
      const { error } = await supabase.from("pricing_calculadora_estados").insert({
        id: calculadoraId,
        user_id: userId,
        nome: dados.nome || "Estado padrão",
        horas_estimadas: dados.horasEstimadas,
        markup: dados.markup,
        produtos: JSON.stringify(dados.produtos),
        custos_extras: JSON.stringify(dados.custosExtras),
        custo_total_calculado: dados.custoTotalCalculado,
        preco_final_calculado: dados.precoFinalCalculado,
        lucratividade: dados.lucratividade,
        is_default: true,
      });

      if (error) throw error;
    }

    console.log("✅ Estado da calculadora salvo no Supabase");
    return true;
  } catch (error) {
    console.error("❌ Erro ao salvar calculadora:", error);
    return false;
  }
}

export async function loadCalculadora(userId: string): Promise<EstadoCalculadora | null> {
  try {
    const { data } = await supabase
      .from("pricing_calculadora_estados")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      nome: data.nome || undefined,
      horasEstimadas: Number(data.horas_estimadas) || 0,
      markup: Number(data.markup) || 2,
      produtos: (data.produtos as any[]) || [],
      custosExtras: (data.custos_extras as any[]) || [],
      custoTotalCalculado: Number(data.custo_total_calculado) || 0,
      precoFinalCalculado: Number(data.preco_final_calculado) || 0,
      lucratividade: Number(data.lucratividade) || 0,
      salvo_automaticamente: true,
      user_id: data.user_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (error) {
    console.error("❌ Erro ao carregar calculadora:", error);
    return null;
  }
}

export async function clearCalculadora(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("pricing_calculadora_estados")
      .delete()
      .eq("user_id", userId)
      .eq("is_default", true);

    if (error) throw error;

    console.log("✅ Calculadora limpa no Supabase");
    return true;
  } catch (error) {
    console.error("❌ Erro ao limpar calculadora:", error);
    return false;
  }
}
