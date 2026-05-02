/**
 * Gestao R2 Signed URL — gera URL pré-assinada para arquivos privados.
 * Body: { storagePath: string, expiresIn?: number }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  corsHeaders,
  getR2Creds,
  r2PresignedGetUrl,
  bucketForPath,
  R2_PRIVATE_BUCKET,
} from "../_shared/r2.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Token inválido" }, 401);

    const { storagePath, expiresIn = 300 } = await req.json();
    if (!storagePath || typeof storagePath !== "string")
      return json({ error: "storagePath obrigatório" }, 400);

    const allowed = await canAccess(supabase, user.id, storagePath);
    if (!allowed) return json({ error: "Acesso negado" }, 403);

    const bucket = bucketForPath(storagePath) || R2_PRIVATE_BUCKET;
    const url = await r2PresignedGetUrl(
      getR2Creds(),
      storagePath,
      Math.min(Number(expiresIn) || 300, 3600),
      bucket
    );
    return json({ url, expiresIn: Math.min(Number(expiresIn) || 300, 3600), bucket }, 200);
  } catch (e) {
    console.error("[gestao-r2-signed-url] error", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

async function canAccess(supabase: any, userId: string, storagePath: string): Promise<boolean> {
  // Path-based: gestao/{client-documents|task-attachments|contratos-assinados}/{userId}/...
  const ownPrefixes = [
    `gestao/client-documents/${userId}/`,
    `gestao/task-attachments/${userId}/`,
    `gestao/contratos-assinados/${userId}/`,
    // Legados (compat com paths antigos do r2-upload):
    `client-documents/${userId}/`,
    `contratos-assinados/${userId}/`,
    `media/task/${userId}/`,
  ];
  if (ownPrefixes.some((p) => storagePath.startsWith(p))) return true;

  // DB fallback
  const { data: doc } = await supabase
    .from("clientes_documentos")
    .select("id")
    .or(`storage_path.eq.${storagePath},r2_storage_path.eq.${storagePath}`)
    .eq("user_id", userId)
    .maybeSingle();
  if (doc) return true;

  const { data: contrato } = await supabase
    .from("contratos")
    .select("id")
    .or(`arquivo_assinado_path.eq.${storagePath},r2_arquivo_assinado_path.eq.${storagePath}`)
    .eq("user_id", userId)
    .maybeSingle();
  if (contrato) return true;

  return false;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
