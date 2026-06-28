/**
 * Implementação Supabase do `AttachmentsRepo`.
 * Único ponto autorizado a tocar `supabase.from('task_attachments')`
 * dentro do módulo `tasks`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AttachmentsRepo, TaskAttachment } from "../../ports/attachmentsRepo";

type Row = Record<string, unknown>;

export function rowToAttachment(r: Row): TaskAttachment {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    name: r.nome as string,
    mimeType: (r.tipo as string) ?? "application/octet-stream",
    sizeBytes: Number(r.tamanho ?? 0),
    storagePath: r.storage_path as string,
    description: (r.descricao as string | null) ?? undefined,
    uploadedAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export const supabaseAttachmentsRepo: AttachmentsRepo = {
  async listByUser(userId) {
    const { data, error } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => rowToAttachment(r as Row));
  },

  async listByTask(taskId, userId) {
    const { data, error } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => rowToAttachment(r as Row));
  },

  async insert(input, userId) {
    const { data, error } = await supabase
      .from("task_attachments")
      .insert({
        task_id: input.taskId,
        user_id: userId,
        nome: input.name,
        tipo: input.mimeType,
        tamanho: input.sizeBytes,
        storage_path: input.storagePath,
        descricao: input.description,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToAttachment(data as Row);
  },

  async remove(id, userId) {
    const { data, error } = await supabase
      .from("task_attachments")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? rowToAttachment(data as Row) : null;
  },
};
