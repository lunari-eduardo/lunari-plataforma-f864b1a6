/**
 * Supabase impl do `ItemsRepo`. Delega ao adapter legado (idempotência + reativação).
 */

import { SupabaseFinancialItemsAdapter } from "@/adapters/SupabaseFinancialItemsAdapter";
import type { ItemsRepo } from "../../ports/itemsRepo";
import type { Grupo, ItemFinanceiro } from "../../domain/types";
import { rowToItem } from "./mappers";

function adapterItemToDomain(it: any): ItemFinanceiro {
  // adapter já retorna shape parcial — normaliza via mapper passando snake_case.
  return rowToItem({
    id: it.id,
    nome: it.nome,
    grupo_principal: it.grupo_principal,
    user_id: it.user_id ?? it.userId,
    ativo: it.ativo,
    created_at: it.created_at ?? it.criadoEm,
    group_code: it.group_code ?? null,
    is_system: it.is_system ?? false,
    archived_at: it.archived_at ?? null,
  });
}

export const supabaseItemsRepo: ItemsRepo = {
  async listAll() {
    const rows = await SupabaseFinancialItemsAdapter.getAllItems();
    return rows.map(adapterItemToDomain);
  },

  async listByGrupo(grupo: Grupo) {
    const rows = await SupabaseFinancialItemsAdapter.getItemsByGroup(grupo as any);
    return rows.map(adapterItemToDomain);
  },

  async create(nome: string, grupo: Grupo) {
    try {
      const row = await SupabaseFinancialItemsAdapter.createItem(nome, grupo as any);
      return adapterItemToDomain(row);
    } catch (err: any) {
      // Idempotência: se já existe ativo, retorna o existente.
      if (err?.code === "DUPLICATE_ACTIVE") {
        const all = await SupabaseFinancialItemsAdapter.getItemsByGroup(grupo as any);
        const found = all.find((i) => (i.nome || "").trim().toLowerCase() === nome.trim().toLowerCase());
        if (found) return adapterItemToDomain(found);
      }
      throw err;
    }
  },

  async update(id, patch) {
    const row = await SupabaseFinancialItemsAdapter.updateItem(id, patch);
    return adapterItemToDomain(row);
  },

  async archive(id) {
    await SupabaseFinancialItemsAdapter.archiveItem(id);
  },

  async remove(id) {
    await SupabaseFinancialItemsAdapter.deleteItem(id);
  },
};
