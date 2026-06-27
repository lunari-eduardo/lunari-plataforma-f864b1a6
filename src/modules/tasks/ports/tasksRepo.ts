/**
 * Porta — repositório de Tasks.
 * `application/` consome esta interface; `infrastructure/supabase/` implementa.
 */

import type { Task } from "../domain/types";

export interface ListTasksFilter {
  userId: string;
  limit?: number;
}

export interface TasksRepo {
  list(filter: ListTasksFilter): Promise<Task[]>;
  getById(id: string, userId: string): Promise<Task | null>;
  create(input: Omit<Task, "id" | "createdAt">, userId: string): Promise<Task>;
  update(id: string, patch: Partial<Task>, userId: string): Promise<Task>;
  remove(id: string, userId: string): Promise<void>;
}
