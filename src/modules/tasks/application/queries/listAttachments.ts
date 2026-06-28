/**
 * Query — lista anexos de uma tarefa (read-through no repo + cache via store).
 */
import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseAttachmentsRepo } from "../../infrastructure/supabase/attachmentsRepo";
import { attachmentsStore } from "../../presentation/store/attachmentsStore";
import { resolveUserId } from "../_auth";

const AttachmentItem = z.object({
  id: z.string(),
  taskId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  storagePath: z.string(),
  uploadedAt: z.string(),
  description: z.string().optional(),
});

export const listTaskAttachments = defineQuery({
  id: "tasks.attachment.list",
  title: "Listar anexos da tarefa",
  description: "Retorna todos os anexos associados a uma tarefa.",
  input: z.object({ taskId: z.string().uuid() }),
  output: z.array(AttachmentItem),
  permissions: ["tasks:read"],
  async handler({ taskId }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      const list = await supabaseAttachmentsRepo.listByTask(taskId, auth.value);
      // Mantém store quente.
      list.forEach((a) => attachmentsStore.upsert(a));
      return ok(list);
    } catch (e) {
      ctx.log.error("falha ao listar anexos", { e });
      return err(
        domainError("EXTERNAL", "Não foi possível listar os anexos.", {
          cause: e,
          retriable: true,
        }),
      );
    }
  },
});
