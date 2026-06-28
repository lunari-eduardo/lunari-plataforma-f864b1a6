/**
 * Porta — repositório de Task Tags configuráveis.
 */

export interface TaskTagDef {
  id: string;
  name: string;
  color?: string;
  order: number;
}

export interface TagsRepo {
  list(userId: string): Promise<TaskTagDef[]>;
  create(input: { name: string; color?: string; order: number }, userId: string): Promise<TaskTagDef>;
  update(id: string, patch: Partial<Pick<TaskTagDef, "name" | "color" | "order">>, userId: string): Promise<void>;
  remove(id: string, userId: string): Promise<void>;
  /** Atualiza `sort_order` de múltiplas tags em batch. */
  reorder(items: Array<{ id: string; order: number }>, userId: string): Promise<void>;
}
