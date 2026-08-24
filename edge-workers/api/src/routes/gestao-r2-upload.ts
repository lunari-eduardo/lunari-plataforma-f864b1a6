import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';
import { getBucketBinding, getCdnUrl, R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET, R2_COMMERCIAL_BUCKET } from '../utils/r2-helpers.js';

export type GestaoContext =
  | "avatar"
  | "logo"
  | "blog"
  | "form"
  | "general"
  | "task"
  | "client-document"
  | "contrato-assinado"
  | "support-ticket"
  | "support-faq"
  | "proposals"
  | "proposals-pdf";

interface ContextRule {
  prefix: (userId: string, entityId?: string) => string;
  isPublic: boolean;
  maxBytes: number;
  allowedTypes?: string[];
}

export const GESTAO_RULES: Record<GestaoContext, ContextRule> = {
  avatar: {
    prefix: (u) => `gestao/avatars/${u}`,
    isPublic: true,
    maxBytes: 5 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  logo: {
    prefix: (u) => `gestao/logos/${u}`,
    isPublic: true,
    maxBytes: 5 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  blog: {
    prefix: (u) => `gestao/blog/${u}`,
    isPublic: true,
    maxBytes: 50 * 1024 * 1024,
  },
  form: {
    prefix: (u) => `gestao/form/${u}`,
    isPublic: true,
    maxBytes: 10 * 1024 * 1024,
  },
  general: {
    prefix: (u) => `gestao/general/${u}`,
    isPublic: true,
    maxBytes: 10 * 1024 * 1024,
  },
  task: {
    prefix: (u, e) => `gestao/task-attachments/${u}${e ? "/" + e : ""}`,
    isPublic: false,
    maxBytes: 10 * 1024 * 1024,
  },
  "client-document": {
    prefix: (u, e) => `gestao/client-documents/${u}${e ? "/" + e : ""}`,
    isPublic: false,
    maxBytes: 10 * 1024 * 1024,
  },
  "contrato-assinado": {
    prefix: (u, e) => `gestao/contratos-assinados/${u}${e ? "/" + e : ""}`,
    isPublic: false,
    maxBytes: 20 * 1024 * 1024,
    allowedTypes: ["application/pdf"],
  },
  "support-ticket": {
    prefix: (u, e) => `gestao/support/tickets/${e ?? "unbound"}/${u}`,
    isPublic: false,
    maxBytes: 50 * 1024 * 1024,
    allowedTypes: [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "video/mp4", "video/webm", "video/quicktime",
    ],
  },
  "support-faq": {
    prefix: (u, e) => `gestao/support/faq/${e ?? "draft"}/${u}`,
    isPublic: true,
    maxBytes: 50 * 1024 * 1024,
    allowedTypes: [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "video/mp4", "video/webm",
    ],
  },
  proposals: {
    prefix: (u) => `gestao/proposals/${u}`,
    isPublic: true,
    maxBytes: 10 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  "proposals-pdf": {
    prefix: (u, e) => `propostas/${u}${e ? "/" + e : ""}`,
    isPublic: true,
    maxBytes: 50 * 1024 * 1024,
    allowedTypes: ["application/pdf"],
  },
};

export async function gestaoR2UploadRoute(c: Context<{ Bindings: Bindings }>) {
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

    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      return c.json({ error: "Body inválido (esperado multipart/form-data)" }, 400);
    }

    const file = formData.get("file") as File | null;
    const context = (formData.get("context") as string) as GestaoContext;
    const entityId = (formData.get("entityId") as string) || undefined;

    if (!file) return c.json({ error: "Arquivo é obrigatório (campo 'file')" }, 400);
    const rule = GESTAO_RULES[context];
    if (!rule) return c.json({ error: `Contexto inválido: ${context}` }, 400);

    if (file.size > rule.maxBytes) {
      return c.json(
        { error: `Arquivo excede ${(rule.maxBytes / 1024 / 1024).toFixed(0)}MB` },
        400
      );
    }
    if (rule.allowedTypes && !rule.allowedTypes.includes(file.type)) {
      return c.json({ error: `Tipo não permitido: ${file.type || "desconhecido"}` }, 400);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const storagePath = `${rule.prefix(user.id, entityId)}/${filename}`;
    const fileData = await file.arrayBuffer();

    const { bucket, bucketName } = getBucketBinding(c.env, storagePath);

    const isPdf = context === "proposals-pdf";
    await bucket.put(storagePath, fileData, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
        cacheControl: isPdf ? "public, max-age=31536000, immutable" : undefined,
        contentDisposition: isPdf ? "inline" : undefined,
      },
    });

    const url = rule.isPublic ? getCdnUrl(c.env, storagePath, bucketName) : "";

    return c.json({
      success: true,
      url,
      storagePath,
      isPublic: rule.isPublic,
      bucket: bucketName,
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (e: any) {
    console.error("[gestao-r2-upload] error", e);
    return c.json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
}
