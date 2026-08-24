import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';
import { getBucketBinding } from '../utils/r2-helpers.js';

export async function signMediaToken(secret: string, storagePath: string, exp: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(`${storagePath}:${exp}`));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyMediaToken(secret: string, storagePath: string, exp: number, sig: string): Promise<boolean> {
  const expectedSig = await signMediaToken(secret, storagePath, exp);
  return expectedSig === sig;
}

export async function gestaoR2SignedUrlRoute(c: Context<{ Bindings: Bindings }>) {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Não autorizado" }, 401);

    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return c.json({ error: "Token inválido" }, 401);

    const body = await c.req.json().catch(() => ({}));
    const { storagePath, expiresIn = 300 } = body;
    if (!storagePath || typeof storagePath !== "string") {
      return c.json({ error: "storagePath obrigatório" }, 400);
    }

    const allowed = await canAccess(supabase, user.id, storagePath);
    if (!allowed) return c.json({ error: "Acesso negado" }, 403);

    const { bucketName } = getBucketBinding(c.env, storagePath);
    const exp = Math.floor(Date.now() / 1000) + Math.min(Number(expiresIn) || 300, 3600);
    const sig = await signMediaToken(c.env.SUPABASE_SERVICE_ROLE_KEY, storagePath, exp);

    const workerBaseUrl = new URL(c.req.url).origin;
    const url = `${workerBaseUrl}/api/media/download?path=${encodeURIComponent(storagePath)}&exp=${exp}&sig=${sig}`;

    return c.json({ url, expiresIn: Math.min(Number(expiresIn) || 300, 3600), bucket: bucketName });
  } catch (e: any) {
    console.error("[gestao-r2-signed-url] error", e);
    return c.json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
}

async function canAccess(supabase: any, userId: string, storagePath: string): Promise<boolean> {
  const ownPrefixes = [
    `gestao/client-documents/${userId}/`,
    `gestao/task-attachments/${userId}/`,
    `gestao/contratos-assinados/${userId}/`,
    `client-documents/${userId}/`,
    `contratos-assinados/${userId}/`,
    `media/task/${userId}/`,
  ];
  if (ownPrefixes.some((p) => storagePath.startsWith(p))) return true;

  if (storagePath.startsWith("gestao/support/tickets/")) {
    const parts = storagePath.split("/");
    const ticketId = parts[3];
    if (ticketId) {
      const { data: isAdmin } = await supabase.rpc("support_is_admin", { _uid: userId });
      if (isAdmin === true) return true;
      const { data: t } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("id", ticketId)
        .eq("user_id", userId)
        .maybeSingle();
      if (t) return true;
    }
    return false;
  }

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
