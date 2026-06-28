/**
 * Hook facade para anexos de tarefa — consome `attachmentsStore` + capabilities.
 * Substitui o legado `src/hooks/useTaskAttachments` (base64 em JSONB).
 */
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useRunCapability } from "@/shared/capability/react";
import { isOk } from "@/shared/result";
import {
  addTaskAttachment,
  removeTaskAttachment,
} from "../../application/commands/attachments";
import { attachmentsR2 } from "../../infrastructure/storage/attachmentsR2";
import { attachmentsStore, useAttachmentsVersion } from "../store/attachmentsStore";

const ALLOWED = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const MAX_BYTES = 10 * 1024 * 1024;

export function useTaskAttachmentsV2(taskId: string | null | undefined) {
  // assina o store para re-render em mudanças.
  useAttachmentsVersion();
  const run = useRunCapability();

  const items = useMemo(
    () => (taskId ? attachmentsStore.byTask(taskId) : []),
    [taskId],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  );

  const upload = useCallback(
    async (file: File) => {
      if (!taskId) {
        toast.error("Salve a tarefa antes de anexar arquivos.");
        return null;
      }
      if (ALLOWED.length && !ALLOWED.includes(file.type)) {
        toast.error(`Tipo não permitido: ${file.type || "desconhecido"}`);
        return null;
      }
      if (file.size > MAX_BYTES) {
        toast.error("Arquivo excede 10MB.");
        return null;
      }
      const res = await run(addTaskAttachment, { taskId, file });
      if (!isOk(res)) {
        toast.error(res.error.message || "Falha ao enviar anexo.");
        return null;
      }
      return res.value;
    },
    [taskId, run],
  );

  const remove = useCallback(
    async (attachmentId: string) => {
      const res = await run(removeTaskAttachment, { attachmentId });
      if (!isOk(res)) {
        toast.error(res.error.message || "Falha ao remover anexo.");
        return false;
      }
      return true;
    },
    [run],
  );

  const openSigned = useCallback(async (storagePath: string) => {
    const url = await attachmentsR2.signedUrl(storagePath);
    if (!url) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  return { items, upload, remove, openSigned };
}
