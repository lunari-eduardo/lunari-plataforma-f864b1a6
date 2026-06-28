/**
 * Porta — repositório de Task People (pessoas atribuíveis a tarefas).
 */

export interface TaskPersonDef {
  id: string;
  name: string;
  color?: string;
  order: number;
}

export interface PeopleRepo {
  list(userId: string): Promise<TaskPersonDef[]>;
  create(input: { name: string; color?: string; order: number }, userId: string): Promise<TaskPersonDef>;
  update(id: string, patch: Partial<Pick<TaskPersonDef, "name" | "color" | "order">>, userId: string): Promise<void>;
  remove(id: string, userId: string): Promise<void>;
  reorder(items: Array<{ id: string; order: number }>, userId: string): Promise<void>;
}
