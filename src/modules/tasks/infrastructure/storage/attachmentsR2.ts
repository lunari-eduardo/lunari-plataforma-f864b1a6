/**
 * Storage adapter — anexos de tarefa em Cloudflare R2.
 * Encapsula upload/delete/signed-url usando as edge functions `gestao-r2-*`.
 */
import { gestaoR2Upload } from "@/lib/gestaoR2Upload";
import { deleteR2Object, resolveR2SignedUrl } from "@/hooks/useR2SignedUrl";

export interface UploadedR2 {
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export const attachmentsR2 = {
  async upload(file: File, taskId: string): Promise<UploadedR2> {
    const res = await gestaoR2Upload({ file, context: "task", entityId: taskId });
    return {
      storagePath: res.storagePath,
      filename: res.filename ?? file.name,
      mimeType: res.mimeType ?? file.type ?? "application/octet-stream",
      sizeBytes: res.fileSize ?? file.size,
    };
  },

  async delete(storagePath: string): Promise<void> {
    if (!storagePath) return;
    await deleteR2Object(storagePath);
  },

  async signedUrl(storagePath: string): Promise<string | null> {
    if (!storagePath) return null;
    return resolveR2SignedUrl(storagePath);
  },
};
