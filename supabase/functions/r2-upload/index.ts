/**
 * Universal R2 Upload (authenticated).
 * Body: multipart/form-data { file, context, entityId? }
 * context ∈ avatar | logo | blog | form | task | client-document | contrato-assinado | general
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, getR2Creds, r2Put, R2_CDN_BASE } from "../_shared/r2.ts";

type Context =
  | "avatar"
  | "logo"
  | "blog"
  | "form"
  | "task"
  | "client-document"
  | "contrato-assinado"
  | "general";

interface ContextRule {
  prefix: (userId: string, entityId?: string) => string;
  isPublic: boolean;
  maxBytes: number;
  allowedTypes?: string[];
}

const RULES: Record<Context, ContextRule> = {
  avatar: { prefix: (u) => `avatars/${u}`, isPublic: true, maxBytes: 5 * 1024 * 1024, allowedTypes: ["image/jpeg", "image/png", "image/webp"] },
  logo: { prefix: (u) => `avatars/${u}`, isPublic: true, maxBytes: 5 * 1024 * 1024, allowedTypes: ["image/jpeg", "image/png", "image/webp"] },
  blog: { prefix: (u) => `media/blog/${u}`, isPublic: true, maxBytes: 50 * 1024 * 1024 },
  form: { prefix: (u) => `media/form/${u}`, isPublic: true, maxBytes: 10 * 1024 * 1024 },
  task: { prefix: (u, e) => `media/task/${u}${e ? "/" + e : ""}`, isPublic: false, maxBytes: 10 * 1024 * 1024 },
  "client-document": {
    prefix: (u, e) => `client-documents/${u}${e ? "/" + e : ""}`,
    isPublic: false,
    maxBytes: 10 * 1024 * 1024,
  },
  "contrato-assinado": {
    prefix: (u, e) => `contratos-assinados/${u}${e ? "/" + e : ""}`,
    isPublic: false,
    maxBytes: 20 * 1024 * 1024,
    allowedTypes: ["application/pdf"],
  },
  general: { prefix: (u) => `media/general/${u}`, isPublic: true, maxBytes: 10 * 1024 * 1024 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autorizado" }, 401);
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Token inválido" }, 401);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const context = (formData.get("context") as string) as Context;
    const entityId = (formData.get("entityId") as string) || undefined;

    if (!file) return json({ error: "Arquivo é obrigatório" }, 400);
    const rule = RULES[context];
    if (!rule) return json({ error: `Contexto inválido: ${context}` }, 400);

    if (file.size > rule.maxBytes) {
      return json({ error: `Arquivo excede ${(rule.maxBytes / 1024 / 1024).toFixed(0)}MB` }, 400);
    }
    if (rule.allowedTypes && !rule.allowedTypes.includes(file.type)) {
      return json({ error: `Tipo não permitido: ${file.type}` }, 400);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const storagePath = `${rule.prefix(user.id, entityId)}/${filename}`;

    const fileData = await file.arrayBuffer();
    await r2Put(getR2Creds(), storagePath, fileData, file.type || "application/octet-stream");

    const url = rule.isPublic ? `${R2_CDN_BASE}/${storagePath}` : "";
    return json({
      success: true,
      url,
      storagePath,
      isPublic: rule.isPublic,
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }, 200);
  } catch (e) {
    console.error("[r2-upload] error", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
