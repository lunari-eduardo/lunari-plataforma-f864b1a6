/**
 * Helper para invocar a edge function `gestao-r2-upload` via `fetch` direto.
 *
 * Por que não `supabase.functions.invoke`?
 * Em algumas combinações de `@supabase/supabase-js` o invoke adiciona
 * `Content-Type: application/json` mesmo quando o body é `FormData`, o que
 * quebra o `req.formData()` na edge function (retorna 400 "Body inválido").
 * Usando `fetch` deixamos o navegador colocar o boundary correto do multipart.
 */
import { supabase } from "@/integrations/supabase/client";

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
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Sessão expirada — faça login novamente.");

  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("context", input.context);
  if (input.entityId) fd.append("entityId", input.entityId);

  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const url = `${baseUrl}/functions/v1/gestao-r2-upload`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey,
        // NÃO setar Content-Type — deixa o browser montar o boundary.
      },
      body: fd,
    });
  } catch (e) {
    throw new Error(
      e instanceof Error ? `Falha de rede: ${e.message}` : "Falha de rede no upload"
    );
  }

  let json: GestaoR2UploadResponse | null = null;
  try {
    json = (await resp.json()) as GestaoR2UploadResponse;
  } catch {
    /* corpo não-JSON */
  }

  if (!resp.ok || !json?.success) {
    const msg = json?.error || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return json;
}
