/**
 * Port: GoalsRepo (`metas_personalizadas`).
 */

import type { MetaPersonalizada } from "../domain/types";

export interface SetGoalInput {
  ano: number;
  mes: number;
  /** "__geral__" para meta global, ou id de categoria/item. */
  categoria: string;
  metaFaturamento: number;
  metaLucro: number;
}

export interface GoalsRepo {
  listByYear(ano: number): Promise<MetaPersonalizada[]>;
  set(input: SetGoalInput): Promise<MetaPersonalizada>;
  remove(id: string): Promise<void>;
}
