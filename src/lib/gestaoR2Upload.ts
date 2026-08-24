/**
 * Helper para invocar a edge function `gestao-r2-upload` via `fetch` direto.
 *
 * Por que não `supabase.functions.invoke`?
 * Em algumas combinações de `@supabase/supabase-js` o invoke adiciona
 * `Content-Type: application/json` mesmo quando o body é `FormData`, o que
 * quebra o `req.formData()` na edge function (retorna 400 "Body inválido").
 * Usando `fetch` deixamos o navegador colocar o boundary correto do multipart.
 */
import { invokeEdgeWorker } from "@/integrations/edge-client";

export interface GestaoR2UploadResponse {
  success: boolean;
  url?: string;
  storagePath: string;
  isPublic?: boolean;
  bucket?: string;
  filename?: string;
  fileSize?: number;
  mimeType?: string;
  error?: string;
}

export interface GestaoR2UploadInput {
  file: File;
  context: string;
  entityId?: string;
}

export async function gestaoR2Upload(
  input: GestaoR2UploadInput
): Promise<GestaoR2UploadResponse> {
  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("context", input.context);
  if (input.entityId) fd.append("entityId", input.entityId);

  const { data, error } = await invokeEdgeWorker<GestaoR2UploadResponse>('api', 'gestao-r2-upload', {
    body: fd,
  });

  if (error || !data?.success) {
    throw new Error(data?.error || error?.message || "Falha no upload");
  }

  return data;
}
