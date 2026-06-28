/**
 * Capabilities de Task Attachments — add/remove.
 * Anexos vivem em R2 (storage privado) com metadata em `task_attachments`.
 */
import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseAttachmentsRepo } from "../../infrastructure/supabase/attachmentsRepo";
import { attachmentsR2 } from "../../infrastructure/storage/attachmentsR2";
import { attachmentsStore } from "../../presentation/store/attachmentsStore";
import { resolveUserId } from "../_auth";

const AttachmentOutput = z.object({
  id: z.string(),
  taskId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  storagePath: z.string(),
  uploadedAt: z.string(),
});

export const addTaskAttachment = defineCommand({
  id: "tasks.attachment.add",
  title: "Adicionar anexo",
  description: "Faz upload de um arquivo para a tarefa (armazenado em R2 privado).",
  // `file` é um `File` do browser — z.any() pois Zod não modela File de forma estrita.
  input: z.object({
    taskId: z.string().uuid(),
    file: z.any(),
    description: z.string().max(500).optional(),
  }),
  output: AttachmentOutput,
  permissions: ["tasks:write"],
  sideEffects: ["db:task_attachments", "storage:r2"],
  async handler(input, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const file = input.file as File;
    if (!file || typeof file !== "object" || !("size" in file)) {
      return err(domainError("VALIDATION", "Arquivo inválido."));
    }

    let uploaded;
    try {
      uploaded = await attachmentsR2.upload(file, input.taskId);
    } catch (e) {
      ctx.log.error("upload R2 falhou", { e });
      return err(
        domainError("EXTERNAL", e instanceof Error ? e.message : "Falha no upload para R2.", {
          cause: e,
          retriable: true,
        }),
      );
    }

    try {
      const row = await supabaseAttachmentsRepo.insert(
        {
          taskId: input.taskId,
          name: uploaded.filename,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          storagePath: uploaded.storagePath,
          description: input.description,
        },
        auth.value,
      );
      // Upsert otimista (realtime confirmará).
      attachmentsStore.upsert(row);
      return ok({
        id: row.id,
        taskId: row.taskId,
        name: row.name,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        storagePath: row.storagePath,
        uploadedAt: row.uploadedAt,
      });
    } catch (e) {
      // Rollback do R2 para não deixar órfão.
      try {
        await attachmentsR2.delete(uploaded.storagePath);
      } catch (rollbackErr) {
        ctx.log.error("rollback R2 falhou", { rollbackErr });
      }
      ctx.log.error("persistência falhou", { e });
      return err(
        domainError("EXTERNAL", "Não foi possível registrar o anexo.", {
          cause: e,
          retriable: true,
        }),
      );
    }
  },
});

export const removeTaskAttachment = defineCommand({
  id: "tasks.attachment.remove",
  title: "Remover anexo",
  description: "Remove um anexo da tarefa (apaga do R2 e do banco).",
  input: z.object({ attachmentId: z.string().uuid() }),
  output: z.object({ id: z.string() }),
  permissions: ["tasks:write"],
  sideEffects: ["db:task_attachments", "storage:r2"],
  needsApproval: true,
  audit: "always",
  async handler({ attachmentId }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      const removed = await supabaseAttachmentsRepo.remove(attachmentId, auth.value);
      if (removed?.storagePath) {
        try {
          await attachmentsR2.delete(removed.storagePath);
        } catch (e) {
          // metadata já foi removida; apenas log.
          ctx.log.error("falha ao apagar do R2", { e });
        }
      }
      attachmentsStore.remove(attachmentId);
      return ok({ id: attachmentId });
    } catch (e) {
      ctx.log.error("falha ao remover anexo", { e });
      return err(
        domainError("EXTERNAL", "Não foi possível remover o anexo.", {
          cause: e,
          retriable: true,
        }),
      );
    }
  },
});
