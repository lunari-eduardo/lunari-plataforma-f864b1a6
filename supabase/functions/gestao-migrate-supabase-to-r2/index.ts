/**
 * One-shot migration: copia objetos do Supabase Storage para Cloudflare R2.
 * Apenas admin do Gestão.
 *
 * Body: { bucket: "avatars" | "client-documents" | "contratos-assinados" | "formulario-uploads" | "blog-images", limit?: number }
 *
 * Buckets públicos legados → bucket R2 público (lunari-previews) com prefixo gestao/...
 * Buckets privados legados → bucket R2 privado (lunari-private) com prefixo gestao/...
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  corsHeaders,
  getR2Creds,
  r2Put,
  R2_CDN_BASE,
  R2_PUBLIC_BUCKET,
  R2_PRIVATE_BUCKET,
} from "../_shared/r2.ts";

interface ListedObj {
  name: string;
  metadata?: { mimetype?: string; size?: number } | null;
}

async function listAll(
  admin: any,
  bucket: string,
  prefix = ""
): Promise<{ path: string; mime?: string; size?: number }[]> {
  const out: { path: string; mime?: string; size?: number }[] = [];
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

function targetFor(bucket: string, sourcePath: string): { path: string; r2Bucket: string; isPublic: boolean } {
  switch (bucket) {
    case "avatars":
      return { path: `gestao/avatars/${sourcePath}`, r2Bucket: R2_PUBLIC_BUCKET, isPublic: true };
    case "blog-images":
      return { path: `gestao/blog/${sourcePath}`, r2Bucket: R2_PUBLIC_BUCKET, isPublic: true };
    case "formulario-uploads":
      return { path: `gestao/form-uploads/${sourcePath}`, r2Bucket: R2_PUBLIC_BUCKET, isPublic: true };
    case "client-documents":
      return { path: `gestao/client-documents/${sourcePath}`, r2Bucket: R2_PRIVATE_BUCKET, isPublic: false };
    case "contratos-assinados":
      return { path: `gestao/contratos-assinados/${sourcePath}`, r2Bucket: R2_PRIVATE_BUCKET, isPublic: false };
    default:
      return { path: `gestao/general/${sourcePath}`, r2Bucket: R2_PUBLIC_BUCKET, isPublic: true };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jres({ error: "Não autorizado" }, 401);
    const {
      data: { user },
    } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return jres({ error: "Token inválido" }, 401);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return jres({ error: "Apenas admins" }, 403);

    const { bucket, limit = 500 } = await req.json();
    if (!bucket || typeof bucket !== "string") return jres({ error: "bucket obrigatório" }, 400);

    const creds = getR2Creds();
    const all = await listAll(admin, bucket);
    const slice = all.slice(0, limit);

    let migrated = 0,
      skipped = 0,
      failed = 0;

    for (const obj of slice) {
      const { path: target, r2Bucket, isPublic } = targetFor(bucket, obj.path);

      const { data: existing } = await admin
        .from("r2_migration_log")
        .select("status")
        .eq("source_bucket", bucket)
        .eq("source_path", obj.path)
        .maybeSingle();
      if (existing?.status === "ok") {
        skipped++;
        continue;
      }

      try {
        const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(obj.path);
        if (dlErr || !blob) throw dlErr || new Error("download falhou");
        const buf = await blob.arrayBuffer();
        await r2Put(creds, target, buf, obj.mime || "application/octet-stream", r2Bucket);

        if (bucket === "client-documents") {
          await admin
            .from("clientes_documentos")
            .update({ r2_storage_path: target })
            .eq("storage_path", obj.path);
        } else if (bucket === "contratos-assinados") {
          await admin
            .from("contratos")
            .update({ r2_arquivo_assinado_path: target })
            .eq("arquivo_assinado_path", obj.path);
        } else if (bucket === "avatars" && isPublic) {
          const oldPublic = admin.storage.from("avatars").getPublicUrl(obj.path).data.publicUrl;
          const newUrl = `${R2_CDN_BASE}/${target}`;
          await admin.from("profiles").update({ avatar_url: newUrl }).eq("avatar_url", oldPublic);
          await admin.from("profiles").update({ logo_url: newUrl }).eq("logo_url", oldPublic);
        } else if (bucket === "blog-images" && isPublic) {
          const oldPublic = admin.storage.from("blog-images").getPublicUrl(obj.path).data.publicUrl;
          const newUrl = `${R2_CDN_BASE}/${target}`;
          await admin
            .from("blog_posts")
            .update({ featured_image_url: newUrl })
            .eq("featured_image_url", oldPublic);
        }

        await admin.from("r2_migration_log").upsert(
          {
            source_bucket: bucket,
            source_path: obj.path,
            target_path: target,
            status: "ok",
            bytes: buf.byteLength,
          },
          { onConflict: "source_bucket,source_path" }
        );
        migrated++;
      } catch (e) {
        failed++;
        await admin.from("r2_migration_log").upsert(
          {
            source_bucket: bucket,
            source_path: obj.path,
            target_path: target,
            status: "error",
            error_message: e instanceof Error ? e.message : String(e),
          },
          { onConflict: "source_bucket,source_path" }
        );
      }
    }

    return jres(
      { ok: true, total: all.length, processed: slice.length, migrated, skipped, failed },
      200
    );
  } catch (e) {
    console.error("[gestao-migrate-supabase-to-r2] error", e);
    return jres({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function jres(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
