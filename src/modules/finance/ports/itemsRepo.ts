/**
 * Port: ItemsRepo (subcategorias financeiras — tabela `fin_items_master`).
 */

import type { ItemFinanceiro, Grupo } from "../domain/types";

export interface ItemsRepo {
  listAll(): Promise<ItemFinanceiro[]>;
  listByGrupo(grupo: Grupo): Promise<ItemFinanceiro[]>;
  /** Idempotente por (user_id, lower(nome), grupo). Retorna o existente se já houver. */
  create(nome: string, grupo: Grupo): Promise<ItemFinanceiro>;
  update(id: string, patch: { nome?: string; ativo?: boolean }): Promise<ItemFinanceiro>;
  archive(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}
