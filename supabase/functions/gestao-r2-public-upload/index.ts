/**
 * Gestao R2 Public Upload — upload sem auth para FormularioPublico.
 * Body: multipart/form-data { file, token, campoId }
 * Salva no bucket público lunari-previews em gestao/form-uploads/{token}/{campoId}/...
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, getR2Creds, r2Put, R2_CDN_BASE, R2_PUBLIC_BUCKET } from "../_shared/r2.ts";

const MAX_BYTES = 10 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const token = formData.get("token") as string | null;
    const campoId = (formData.get("campoId") as string) || "geral";

    if (!file) return json({ error: "Arquivo obrigatório" }, 400);
    if (!token) return json({ error: "Token obrigatório" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "Arquivo excede 10MB" }, 400);

    const { data: form, error: fErr } = await supabase
      .from("formularios")
      .select("id, status")
      .eq("token", token)
      .maybeSingle();
    if (fErr || !form || form.status !== "publicado") {
      return json({ error: "Formulário inválido" }, 403);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const storagePath = `gestao/form-uploads/${token}/${campoId}/${filename}`;
    const data = await file.arrayBuffer();

    await r2Put(
      getR2Creds(),
      storagePath,
      data,
      file.type || "application/octet-stream",
      R2_PUBLIC_BUCKET
    );
    const url = `${R2_CDN_BASE}/${storagePath}`;
    return json({ success: true, url, storagePath }, 200);
  } catch (e) {
    console.error("[gestao-r2-public-upload] error", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
