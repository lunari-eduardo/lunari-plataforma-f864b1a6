/**
 * One-shot migration: copia objetos do Supabase Storage para Cloudflare R2.
 * Chamada manual (POST) com { bucket: "avatars" | "client-documents" | "contratos-assinados" | "formulario-uploads" | "blog-images", limit?: number }.
 *
 * - Para cada objeto: baixa do Supabase, faz PUT no R2 no novo prefixo,
 *   atualiza tabelas relacionadas (clientes_documentos.r2_storage_path,
 *   contratos.r2_arquivo_assinado_path, profiles.avatar_url/logo_url),
 *   loga em r2_migration_log.
 * - Não deleta o original.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, getR2Creds, r2Put, R2_CDN_BASE } from "../_shared/r2.ts";

interface ListedObj { name: string; metadata?: { mimetype?: string; size?: number } | null }

async function listAll(admin: any, bucket: string, prefix = ""): Promise<{ path: string; mime?: string; size?: number }[]> {
  const out: { path: string; mime?: string; size?: number }[] = [];
  // Recursivo simples: lista um prefixo e desce em "pastas"
  const stack: string[] = [prefix];
  while (stack.length) {
    const p = stack.shift()!;
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(p, { limit: 1000, offset });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const obj of data as ListedObj[]) {
        const full = p ? `${p}/${obj.name}` : obj.name;
        if (!obj.metadata) {
          // pasta
          stack.push(full);
        } else {
          out.push({ path: full, mime: obj.metadata?.mimetype, size: obj.metadata?.size });
        }
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  return out;
}

function targetPath(bucket: string, sourcePath: string): string {
  switch (bucket) {
    case "avatars": return `avatars/${sourcePath}`;
    case "client-documents": return `client-documents/${sourcePath}`;
    case "contratos-assinados": return `contratos-assinados/${sourcePath}`;
    case "formulario-uploads": return `formulario-uploads/${sourcePath}`;
    case "blog-images": return `media/blog/${sourcePath}`;
    default: return `media/general/${sourcePath}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth: somente admin do sistema
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jres({ error: "Não autorizado" }, 401);
    const { data: { user } } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return jres({ error: "Token inválido" }, 401);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return jres({ error: "Apenas admins" }, 403);

    const { bucket, limit = 500 } = await req.json();
    if (!bucket || typeof bucket !== "string") return jres({ error: "bucket obrigatório" }, 400);

    const creds = getR2Creds();
    const all = await listAll(admin, bucket);
    const slice = all.slice(0, limit);

    let migrated = 0, skipped = 0, failed = 0;
    for (const obj of slice) {
      const target = targetPath(bucket, obj.path);

      // Já migrado?
      const { data: existing } = await admin
        .from("r2_migration_log")
        .select("status")
        .eq("source_bucket", bucket)
        .eq("source_path", obj.path)
        .maybeSingle();
      if (existing?.status === "ok") { skipped++; continue; }

      try {
        const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(obj.path);
        if (dlErr || !blob) throw dlErr || new Error("download falhou");
        const buf = await blob.arrayBuffer();
        await r2Put(creds, target, buf, obj.mime || "application/octet-stream");

        // Atualiza referências de DB
        if (bucket === "client-documents") {
          await admin.from("clientes_documentos")
            .update({ r2_storage_path: target })
            .eq("storage_path", obj.path);
        } else if (bucket === "contratos-assinados") {
          await admin.from("contratos")
            .update({ r2_arquivo_assinado_path: target })
            .eq("arquivo_assinado_path", obj.path);
        } else if (bucket === "avatars") {
          // Atualiza profiles que apontam para a URL pública antiga deste arquivo
          const oldPublic = admin.storage.from("avatars").getPublicUrl(obj.path).data.publicUrl;
          const newUrl = `${R2_CDN_BASE}/${target}`;
          await admin.from("profiles").update({ avatar_url: newUrl }).eq("avatar_url", oldPublic);
          await admin.from("profiles").update({ logo_url: newUrl }).eq("logo_url", oldPublic);
        }

        await admin.from("r2_migration_log").upsert({
          source_bucket: bucket, source_path: obj.path,
          target_path: target, status: "ok", bytes: buf.byteLength,
        }, { onConflict: "source_bucket,source_path" });
        migrated++;
      } catch (e) {
        failed++;
        await admin.from("r2_migration_log").upsert({
          source_bucket: bucket, source_path: obj.path,
          target_path: target, status: "error",
          error_message: e instanceof Error ? e.message : String(e),
        }, { onConflict: "source_bucket,source_path" });
      }
    }

    return jres({ ok: true, total: all.length, processed: slice.length, migrated, skipped, failed }, 200);
  } catch (e) {
    console.error("[migrate-supabase-to-r2] error", e);
    return jres({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function jres(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
