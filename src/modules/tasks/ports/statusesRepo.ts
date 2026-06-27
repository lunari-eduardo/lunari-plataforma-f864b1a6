/**
 * Porta — repositório de Task Statuses configuráveis.
 */

import type { TaskStatusDef } from "../domain/types";

export interface StatusesRepo {
  list(userId: string): Promise<TaskStatusDef[]>;
}
