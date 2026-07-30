/**
 * Provider: rollout — expõe a decisão declarada de rollout do assistente Lu.
 * Fonte: `app_settings.assistant_rollout_stage` (admin | beta | geral).
 * É um fato declarado por Admin — cabe em Context.
 */
import type { ContextFact, ContextProvider } from "..";
import { supabase } from "@/integrations/supabase/client";

export const rolloutContextProvider: ContextProvider = {
  id: "rollout",
  async load(): Promise<ContextFact[]> {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", "assistant_rollout_stage")
      .maybeSingle();
    if (error || !data) return [];
    const raw = (data as { value?: unknown }).value;
    const value = raw === "admin" || raw === "beta" || raw === "geral" ? raw : null;
    if (!value) return [];
    return [
      {
        key: "rollout.assistant_stage",
        value,
        source: "human",
        confidence: "high",
        updatedAt: (data as { updated_at?: string }).updated_at,
      },
    ];
  },
};
