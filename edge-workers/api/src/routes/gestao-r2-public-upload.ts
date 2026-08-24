import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';
import { getCdnUrl, R2_PUBLIC_BUCKET } from '../utils/r2-helpers.js';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function gestaoR2PublicUploadRoute(c: Context<{ Bindings: Bindings }>) {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const token = formData.get("token") as string | null;
    const campoId = (formData.get("campoId") as string) || "geral";

    if (!file) return c.json({ error: "Arquivo obrigatório" }, 400);
    if (!token) return c.json({ error: "Token obrigatório" }, 400);
    if (file.size > MAX_BYTES) return c.json({ error: "Arquivo excede 10MB" }, 400);

    const { data: form, error: fErr } = await supabase
      .from("formularios")
      .select("id, status")
      .eq("token", token)
      .maybeSingle();

    if (fErr || !form || form.status !== "publicado") {
      return c.json({ error: "Formulário inválido" }, 403);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const storagePath = `gestao/form-uploads/${token}/${campoId}/${filename}`;
    const data = await file.arrayBuffer();

    // Gravação nativa no Cloudflare R2
    await c.env.LUNARI_PREVIEWS.put(storagePath, data, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
    });

    const url = getCdnUrl(c.env, storagePath, R2_PUBLIC_BUCKET);
    return c.json({ success: true, url, storagePath });
  } catch (e: any) {
    console.error("[gestao-r2-public-upload] error", e);
    return c.json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
}
