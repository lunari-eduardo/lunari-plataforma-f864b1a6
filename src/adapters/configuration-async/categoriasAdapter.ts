import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Categoria } from "@/types/configuration";

export async function loadCategorias(): Promise<Categoria[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.warn("User not authenticated, returning default categorias");
      return [];
    }

    const { data, error } = await supabase.from("categorias").select("*").order("nome");

    if (error) {
      console.error("Error loading categorias from Supabase:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log("🏷️ No categorias found, returning empty array");
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      nome: row.nome,
      cor: row.cor,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (error) {
    console.error("Failed to load categorias:", error);
    throw error;
  }
}

export async function saveCategorias(categorias: Categoria[]): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    const uniqueCategorias = Array.from(new Map(categorias.map((c) => [c.id, c])).values());

    if (uniqueCategorias.length < categorias.length) {
      console.log(`💾 Removed ${categorias.length - uniqueCategorias.length} duplicate categorias`);
    }

    const categoriasData = uniqueCategorias.map((categoria) => ({
      id: categoria.id,
      user_id: user.user.id,
      nome: categoria.nome,
      cor: categoria.cor,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("categorias").upsert(categoriasData, {
      onConflict: "id",
    });

    if (error) {
      console.error("Error saving categorias to Supabase:", error);
      throw error;
    }

    console.log(`✅ Successfully saved ${uniqueCategorias.length} categorias to Supabase`);
  } catch (error) {
    console.error("Failed to save categorias:", error);
    toast.error("Erro ao salvar categorias. Dados podem não estar sincronizados.");
    throw error;
  }
}

export async function updateCategoriaById(id: string, dados: Partial<Categoria>): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    const { error } = await supabase
      .from("categorias")
      .update({
        ...dados,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.user.id);

    if (error) {
      console.error("Error updating categoria in Supabase:", error);
      throw error;
    }

    console.log(`Successfully updated categoria ${id} in Supabase`);
  } catch (error) {
    console.error("Failed to update categoria:", error);
    throw error;
  }
}

export async function deleteCategoriaById(id: string): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    const { error } = await supabase
      .from("categorias")
      .delete()
      .eq("id", id)
      .eq("user_id", user.user.id);

    if (error) {
      console.error("Error deleting categoria from Supabase:", error);
      throw error;
    }

    console.log(`Successfully deleted categoria ${id} from Supabase`);
  } catch (error) {
    console.error("Failed to delete categoria:", error);
    throw error;
  }
}

export async function syncCategorias(categorias: Categoria[]): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    const { data: supabaseCategorias, error: fetchError } = await supabase
      .from("categorias")
      .select("id")
      .eq("user_id", user.user.id);

    if (fetchError) {
      console.error("Error fetching categorias from Supabase:", fetchError);
      throw fetchError;
    }

    const currentIds = categorias.map((cat) => cat.id);
    const supabaseIds = (supabaseCategorias || []).map((cat) => cat.id);

    const toDelete = supabaseIds.filter((id) => !currentIds.includes(id));

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("categorias")
        .delete()
        .in("id", toDelete)
        .eq("user_id", user.user.id);

      if (deleteError) {
        console.error("Error deleting orphaned categorias:", deleteError);
        throw deleteError;
      }

      console.log(`Deleted ${toDelete.length} orphaned categorias from Supabase`);
    }

    if (categorias.length > 0) {
      await saveCategorias(categorias);
    }

    console.log(`Successfully synced ${categorias.length} categorias with Supabase`);
  } catch (error) {
    console.error("Failed to sync categorias:", error);
    throw error;
  }
}
