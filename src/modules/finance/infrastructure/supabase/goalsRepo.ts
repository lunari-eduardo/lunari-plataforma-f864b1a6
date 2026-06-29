/**
 * Supabase impl do `GoalsRepo` (tabela `metas_personalizadas`).
 * Upsert por (user_id, ano, mes, categoria).
 */

import { supabase } from "@/integrations/supabase/client";
import type { GoalsRepo, SetGoalInput } from "../../ports/goalsRepo";
import { rowToMeta } from "./mappers";

export const supabaseGoalsRepo: GoalsRepo = {
  async listByYear(ano) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("metas_personalizadas")
      .select("*")
      .eq("user_id", user.id)
      .eq("ano", ano)
      .order("mes");
    if (error) throw error;
    return (data || []).map(rowToMeta);
  },

  async set(input: SetGoalInput) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const payload = {
      user_id: user.id,
      ano: input.ano,
      mes: input.mes,
      categoria: input.categoria,
      meta_faturamento: input.metaFaturamento,
      meta_lucro: input.metaLucro,
    };

    const { data, error } = await supabase
      .from("metas_personalizadas")
      .upsert(payload as any, { onConflict: "user_id,ano,mes,categoria" })
      .select()
      .single();
    if (error) throw error;
    return rowToMeta(data);
  },

  async remove(id) {
    const { error } = await supabase.from("metas_personalizadas").delete().eq("id", id);
    if (error) throw error;
  },
};
