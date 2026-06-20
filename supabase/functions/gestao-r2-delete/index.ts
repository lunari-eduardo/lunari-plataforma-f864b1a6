/**
 * Gestao R2 Delete — apaga objeto do R2 (público ou privado).
 * Body: { storagePath: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, getR2Creds, r2Delete, bucketForPath } from "../_shared/r2.ts";

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

    const { storagePath } = await req.json();
    if (!storagePath || typeof storagePath !== "string")
      return json({ error: "storagePath obrigatório" }, 400);

    const ownPrefixes = [
      `gestao/avatars/${user.id}/`,
      `gestao/logos/${user.id}/`,
      `gestao/blog/${user.id}/`,
      `gestao/form/${user.id}/`,
      `gestao/general/${user.id}/`,
      `gestao/client-documents/${user.id}/`,
      `gestao/task-attachments/${user.id}/`,
      `gestao/contratos-assinados/${user.id}/`,
      // Legados
      `avatars/${user.id}/`,
      `client-documents/${user.id}/`,
      `contratos-assinados/${user.id}/`,
      `media/blog/${user.id}/`,
      `media/form/${user.id}/`,
      `media/task/${user.id}/`,
      `media/general/${user.id}/`,
    ];
    let allowed = ownPrefixes.some((p) => storagePath.startsWith(p));

    // Suporte: admin pode deletar qualquer anexo; user só os próprios uploads
    if (!allowed && storagePath.startsWith("gestao/support/")) {
      const { data: isAdmin } = await supabase.rpc("support_is_admin", { _uid: user.id });
      if (isAdmin === true) {
        allowed = true;
      } else if (storagePath.startsWith("gestao/support/tickets/")) {
        // path: gestao/support/tickets/{ticket_id}/{uploader_id}/...
        const parts = storagePath.split("/");
        if (parts[4] === user.id) allowed = true;
      }
    }

    if (!allowed) {
      return json({ error: "Acesso negado" }, 403);
    }

    const bucket = bucketForPath(storagePath);
    await r2Delete(getR2Creds(), storagePath, bucket);
    return json({ success: true, bucket }, 200);
  } catch (e) {
    console.error("[gestao-r2-delete] error", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
