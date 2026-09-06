import { supabase } from "@/integrations/supabase/client";
import type { Pacote } from "@/types/configuration";

export async function loadPacotes(): Promise<Pacote[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.log("📦 User not authenticated, returning default pacotes");
      return [];
    }

    const { data, error } = await (supabase as any)
      .from("pacotes")
      .select("*")
      .eq("user_id", user.user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("📦 Error loading pacotes from Supabase:", error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log("📦 No pacotes found, returning empty array");
      return [];
    }

    const pacotes: Pacote[] = data.map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      nome: item.nome,
      categoria_id: item.categoria_id,
      valor_base: Number(item.valor_base),
      valor_foto_extra: Number(item.valor_foto_extra),
      fotos_incluidas: Number(item.fotos_incluidas) || 0,
      duracao_minutos:
        item.duracao_minutos !== null && item.duracao_minutos !== undefined
          ? Number(item.duracao_minutos)
          : 0,
      produtosIncluidos: Array.isArray(item.produtos_incluidos) ? item.produtos_incluidos : [],
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    console.log(`📦 Loaded ${pacotes.length} pacotes from Supabase`);
    return pacotes;
  } catch (error) {
    console.error("📦 Unexpected error loading pacotes:", error);
    return [];
  }
}

export async function savePacotes(pacotes: Pacote[]): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    if (pacotes.length === 0) {
      console.log("📦 No pacotes to save");
      return;
    }

    const uniquePacotes = Array.from(new Map(pacotes.map((p) => [p.id, p])).values());

    if (uniquePacotes.length < pacotes.length) {
      console.log(`📦 Removed ${pacotes.length - uniquePacotes.length} duplicate pacotes`);
    }

    const supabaseData = uniquePacotes.map((pacote) => ({
      id: pacote.id,
      user_id: user.user.id,
      nome: pacote.nome,
      categoria_id: pacote.categoria_id,
      valor_base: pacote.valor_base,
      valor_foto_extra: pacote.valor_foto_extra,
      fotos_incluidas: pacote.fotos_incluidas || 0,
      duracao_minutos: pacote.duracao_minutos !== undefined ? Number(pacote.duracao_minutos) : 0,
      produtos_incluidos: pacote.produtosIncluidos,
      created_at: pacote.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await (supabase as any).from("pacotes").upsert(supabaseData, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("📦 Error saving pacotes to Supabase:", error);
      throw error;
    }

    console.log(`📦 Successfully saved ${uniquePacotes.length} pacotes to Supabase`);
  } catch (error) {
    console.error("📦 Error in savePacotes:", error);
    throw error;
  }
}

export async function deletePacoteById(id: string): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    const { error } = await (supabase as any)
      .from("pacotes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.user.id);

    if (error) {
      console.error("📦 Error deleting pacote from Supabase:", error);
      throw error;
    }

    console.log(`📦 Successfully deleted pacote ${id} from Supabase`);
  } catch (error) {
    console.error("📦 Error in deletePacoteById:", error);
    throw error;
  }
}

export async function syncPacotes(pacotes: Pacote[]): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.log("📦 User not authenticated, skipping sync");
      return;
    }

    const { data: currentData, error: fetchError } = await (supabase as any)
      .from("pacotes")
      .select("id")
      .eq("user_id", user.user.id);

    if (fetchError) {
      console.error("📦 Error fetching current pacotes:", fetchError);
      throw fetchError;
    }

    const currentIds = new Set(currentData?.map((item: any) => item.id) || []);
    const newIds = new Set(pacotes.map((p) => p.id));

    const toDelete = [...currentIds].filter((id: string) => !newIds.has(id));
    if (toDelete.length > 0) {
      const { error: deleteError } = await (supabase as any)
        .from("pacotes")
        .delete()
        .in("id", toDelete)
        .eq("user_id", user.user.id);

      if (deleteError) {
        console.error("📦 Error deleting orphaned pacotes:", deleteError);
      } else {
        console.log(`📦 Deleted ${toDelete.length} orphaned pacotes`);
      }
    }

    if (pacotes.length > 0) {
      await savePacotes(pacotes);
    }

    console.log("📦 Pacotes sync completed");
  } catch (error) {
    console.error("📦 Error in syncPacotes:", error);
    throw error;
  }
}
