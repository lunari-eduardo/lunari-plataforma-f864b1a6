import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CUSTOM_FLOW_DEFAULT } from "@/features/workflow/domain/productFlow";

/**
 * Preferências do Workflow armazenadas em `user_preferences.configuracoes_workflow`.
 * v1: apenas `ultimoFluxoCustom` — lista de nomes de etapas usada como sugestão
 * padrão quando o usuário troca para "Personalizado" em um novo produto.
 */
interface WorkflowPrefs {
  ultimoFluxoCustom: string[];
}

const DEFAULT: WorkflowPrefs = {
  ultimoFluxoCustom: CUSTOM_FLOW_DEFAULT,
};

export function useWorkflowPreferences() {
  const [prefs, setPrefs] = useState<WorkflowPrefs>(DEFAULT);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setIsReady(true); return; }
      const { data } = await supabase
        .from("user_preferences")
        .select("configuracoes_workflow")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const cfg = (data?.configuracoes_workflow ?? {}) as Partial<WorkflowPrefs>;
      setPrefs({
        ultimoFluxoCustom:
          Array.isArray(cfg.ultimoFluxoCustom) && cfg.ultimoFluxoCustom.length > 0
            ? cfg.ultimoFluxoCustom
            : DEFAULT.ultimoFluxoCustom,
      });
      setIsReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const saveUltimoFluxoCustom = useCallback(async (nomes: string[]) => {
    const clean = nomes.map((n) => (n || "").trim()).filter(Boolean);
    if (clean.length === 0) return;
    setPrefs((p) => ({ ...p, ultimoFluxoCustom: clean }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing } = await supabase
      .from("user_preferences")
      .select("id, configuracoes_workflow")
      .eq("user_id", user.id)
      .maybeSingle();
    const currentCfg = (existing?.configuracoes_workflow ?? {}) as Record<string, unknown>;
    const merged = { ...currentCfg, ultimoFluxoCustom: clean };
    if (existing?.id) {
      await supabase
        .from("user_preferences")
        .update({ configuracoes_workflow: merged })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("user_preferences")
        .insert({ user_id: user.id, configuracoes_workflow: merged });
    }
  }, []);

  return { prefs, isReady, saveUltimoFluxoCustom };
}
