import { supabase } from "@/integrations/supabase/client";
import type { Produto } from "@/types/configuration";

export async function loadProdutos(): Promise<Produto[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.log("🛍️ User not authenticated, returning default produtos");
      return [];
    }

    const { data, error } = await (supabase as any)
      .from("produtos")
      .select("*")
      .eq("user_id", user.user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("🛍️ Error loading produtos from Supabase:", error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log("🛍️ No produtos found, returning empty array");
      return [];
    }

    const produtos: Produto[] = data.map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      nome: item.nome,
      preco_custo: Number(item.preco_custo),
      preco_venda: Number(item.preco_venda),
      favorito: Boolean(item.favorito),
      favorited_at: item.favorited_at ?? null,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    console.log(`🛍️ Loaded ${produtos.length} produtos from Supabase`);
    return produtos;
  } catch (error) {
    console.error("🛍️ Unexpected error loading produtos:", error);
    return [];
  }
}

export async function saveProdutos(produtos: Produto[]): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    if (produtos.length === 0) {
      console.log("🛍️ No produtos to save");
      return;
    }

    const uniqueProdutos = Array.from(new Map(produtos.map((p) => [p.id, p])).values());

    if (uniqueProdutos.length < produtos.length) {
      console.log(`🛍️ Removed ${produtos.length - uniqueProdutos.length} duplicate produtos`);
    }

    const supabaseData = uniqueProdutos.map((produto) => ({
      id: produto.id,
      user_id: user.user.id,
      nome: produto.nome,
      preco_custo: produto.preco_custo,
      preco_venda: produto.preco_venda,
      favorito: produto.favorito ?? false,
      created_at: produto.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await (supabase as any).from("produtos").upsert(supabaseData, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("🛍️ Error saving produtos to Supabase:", error);
      throw error;
    }

    console.log(`🛍️ Successfully saved ${uniqueProdutos.length} produtos to Supabase`);
  } catch (error) {
    console.error("🛍️ Error in saveProdutos:", error);
    throw error;
  }
}

export async function deleteProdutoById(id: string): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    const { error } = await (supabase as any)
      .from("produtos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.user.id);

    if (error) {
      console.error("🛍️ Error deleting produto from Supabase:", error);
      throw error;
    }

    console.log(`🛍️ Successfully deleted produto ${id} from Supabase`);
  } catch (error) {
    console.error("🛍️ Error in deleteProdutoById:", error);
    throw error;
  }
}

export async function syncProdutos(produtos: Produto[]): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.log("🛍️ User not authenticated, skipping sync");
      return;
    }

    const { data: currentData, error: fetchError } = await (supabase as any)
      .from("produtos")
      .select("id")
      .eq("user_id", user.user.id);

    if (fetchError) {
      console.error("🛍️ Error fetching current produtos:", fetchError);
      throw fetchError;
    }

    const currentIds = new Set(currentData?.map((item: any) => item.id) || []);
    const newIds = new Set(produtos.map((p) => p.id));

    const toDelete = [...currentIds].filter((id: string) => !newIds.has(id));
    if (toDelete.length > 0) {
      const { error: deleteError } = await (supabase as any)
        .from("produtos")
        .delete()
        .in("id", toDelete)
        .eq("user_id", user.user.id);

      if (deleteError) {
        console.error("🛍️ Error deleting orphaned produtos:", deleteError);
      } else {
        console.log(`🛍️ Deleted ${toDelete.length} orphaned produtos`);
      }
    }

    if (produtos.length > 0) {
      await saveProdutos(produtos);
    }

    console.log("🛍️ Produtos sync completed");
  } catch (error) {
    console.error("🛍️ Error in syncProdutos:", error);
    throw error;
  }
}
