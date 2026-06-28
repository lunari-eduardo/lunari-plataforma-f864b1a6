/**
 * Porta — repositório de anexos de tarefa.
 * Fonte única: tabela `task_attachments` (storage_path apontando para R2).
 */

export interface TaskAttachment {
  id: string;
  taskId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  description?: string;
  uploadedAt: string;
}

export interface AttachmentsRepo {
  listByUser(userId: string): Promise<TaskAttachment[]>;
  listByTask(taskId: string, userId: string): Promise<TaskAttachment[]>;
  insert(
    input: Omit<TaskAttachment, "id" | "uploadedAt">,
    userId: string,
  ): Promise<TaskAttachment>;
  remove(id: string, userId: string): Promise<TaskAttachment | null>;
}
