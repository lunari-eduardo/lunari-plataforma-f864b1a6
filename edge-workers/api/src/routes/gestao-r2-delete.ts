import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';
import { getBucketBinding } from '../utils/r2-helpers.js';

export async function gestaoR2DeleteRoute(c: Context<{ Bindings: Bindings }>) {
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
    const { storagePath } = body;
    if (!storagePath || typeof storagePath !== "string") {
      return c.json({ error: "storagePath obrigatório" }, 400);
    }

    const ownPrefixes = [
      `gestao/avatars/${user.id}/`,
      `gestao/logos/${user.id}/`,
      `gestao/blog/${user.id}/`,
      `gestao/form/${user.id}/`,
      `gestao/general/${user.id}/`,
      `gestao/client-documents/${user.id}/`,
      `gestao/task-attachments/${user.id}/`,
      `gestao/contratos-assinados/${user.id}/`,
      `avatars/${user.id}/`,
      `client-documents/${user.id}/`,
      `contratos-assinados/${user.id}/`,
      `media/blog/${user.id}/`,
      `media/form/${user.id}/`,
      `media/task/${user.id}/`,
      `media/general/${user.id}/`,
    ];
    let allowed = ownPrefixes.some((p) => storagePath.startsWith(p));

    if (!allowed && storagePath.startsWith("gestao/support/")) {
      const { data: isAdmin } = await supabase.rpc("support_is_admin", { _uid: user.id });
      if (isAdmin === true) {
        allowed = true;
      } else if (storagePath.startsWith("gestao/support/tickets/")) {
        const parts = storagePath.split("/");
        if (parts[4] === user.id) allowed = true;
      }
    }

    if (!allowed) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const { bucket, bucketName } = getBucketBinding(c.env, storagePath);
    await bucket.delete(storagePath);

    return c.json({ success: true, bucket: bucketName });
  } catch (e: any) {
    console.error("[gestao-r2-delete] error", e);
    return c.json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
}
