/**
 * Deletes an object from R2.
 * Body: { storagePath: string }
 * Validates ownership via path prefix or DB lookup.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, getR2Creds, r2Delete } from "../_shared/r2.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Token inválido" }, 401);

    const { storagePath } = await req.json();
    if (!storagePath || typeof storagePath !== "string") return json({ error: "storagePath obrigatório" }, 400);

    // Authorization: caminho deve conter o user.id
    const ownPrefixes = [
      `avatars/${user.id}/`,
      `client-documents/${user.id}/`,
      `contratos-assinados/${user.id}/`,
      `media/blog/${user.id}/`,
      `media/form/${user.id}/`,
      `media/task/${user.id}/`,
      `media/general/${user.id}/`,
    ];
    if (!ownPrefixes.some((p) => storagePath.startsWith(p))) {
      return json({ error: "Acesso negado" }, 403);
    }

    await r2Delete(getR2Creds(), storagePath);
    return json({ success: true }, 200);
  } catch (e) {
    console.error("[r2-delete] error", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
