import { supabase } from "@/integrations/supabase/client";
import type { EtapaTrabalho } from "@/types/configuration";

export async function loadEtapas(): Promise<EtapaTrabalho[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.log("📋 User not authenticated, returning default etapas");
      return [];
    }

    const { data, error } = await (supabase as any)
      .from("etapas_trabalho")
      .select("*")
      .eq("user_id", user.user.id)
      .order("ordem", { ascending: true });

    if (error) {
      console.error("📋 Error loading etapas from Supabase:", error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log("📋 No etapas found, returning empty array");
      return [];
    }

    const etapas: EtapaTrabalho[] = data.map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      nome: item.nome,
      cor: item.cor,
      ordem: Number(item.ordem),
      is_system_status: item.is_system_status ?? false,
      is_hidden_in_workflow: item.is_hidden_in_workflow ?? false,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    console.log(`📋 Loaded ${etapas.length} etapas from Supabase`);
    return etapas;
  } catch (error) {
    console.error("📋 Unexpected error loading etapas:", error);
    return [];
  }
}

export async function saveEtapas(etapas: EtapaTrabalho[]): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    if (etapas.length === 0) {
      console.log("📋 No etapas to save");
      return;
    }

    const uniqueEtapas = Array.from(new Map(etapas.map((e) => [e.id, e])).values());

    if (uniqueEtapas.length < etapas.length) {
      console.log(`📋 Removed ${etapas.length - uniqueEtapas.length} duplicate etapas`);
    }

    const supabaseData = uniqueEtapas.map((etapa) => ({
      id: etapa.id,
      user_id: user.user.id,
      nome: etapa.nome,
      cor: etapa.cor,
      ordem: etapa.ordem,
      is_system_status: etapa.is_system_status ?? false,
      is_hidden_in_workflow: etapa.is_hidden_in_workflow ?? false,
      created_at: etapa.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await (supabase as any).from("etapas_trabalho").upsert(supabaseData, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("📋 Error saving etapas to Supabase:", error);
      throw error;
    }

    console.log(`📋 Successfully saved ${uniqueEtapas.length} etapas to Supabase`);
  } catch (error) {
    console.error("📋 Error in saveEtapas:", error);
    throw error;
  }
}

export async function deleteEtapaById(id: string): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    const { error } = await (supabase as any)
      .from("etapas_trabalho")
      .delete()
      .eq("id", id)
      .eq("user_id", user.user.id);

    if (error) {
      console.error("📋 Error deleting etapa from Supabase:", error);
      throw error;
    }

    console.log(`📋 Successfully deleted etapa ${id} from Supabase`);
  } catch (error) {
    console.error("📋 Error in deleteEtapaById:", error);
    throw error;
  }
}

export async function syncEtapas(etapas: EtapaTrabalho[]): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.log("📋 User not authenticated, skipping sync");
      return;
    }

    const { data: currentData, error: fetchError } = await (supabase as any)
      .from("etapas_trabalho")
      .select("id")
      .eq("user_id", user.user.id);

    if (fetchError) {
      console.error("📋 Error fetching current etapas:", fetchError);
      throw fetchError;
    }

    const currentIds = new Set(currentData?.map((item: any) => item.id) || []);
    const newIds = new Set(etapas.map((e) => e.id));

    const toDelete = [...currentIds].filter((id: string) => !newIds.has(id));
    if (toDelete.length > 0) {
      const { error: deleteError } = await (supabase as any)
        .from("etapas_trabalho")
        .delete()
        .in("id", toDelete)
        .eq("user_id", user.user.id);

      if (deleteError) {
        console.error("📋 Error deleting orphaned etapas:", deleteError);
      } else {
        console.log(`📋 Deleted ${toDelete.length} orphaned etapas`);
      }
    }

    if (etapas.length > 0) {
      await saveEtapas(etapas);
    }

    console.log("📋 Etapas sync completed");
  } catch (error) {
    console.error("📋 Error in syncEtapas:", error);
    throw error;
  }
}
