/**
 * Gestao R2 Upload (authenticated, exclusivo do Gestão).
 * Não conflita com a função `r2-upload` do Gallery.
 *
 * Body: multipart/form-data { file, context, entityId? }
 * context ∈ avatar | logo | blog | form | general | task | client-document | contrato-assinado
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  corsHeaders,
  getR2Creds,
  r2Put,
  R2_CDN_BASE,
  GESTAO_RULES,
  GestaoContext,
} from "../_shared/r2.ts";

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const reqContentType = req.headers.get("content-type") || "";
    console.log(`[${requestId}] gestao-r2-upload start ct="${reqContentType}"`);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      console.error(`[${requestId}] auth error`, authErr);
      return json({ error: "Token inválido" }, 401);
    }

    if (!reqContentType.toLowerCase().startsWith("multipart/form-data")) {
      console.error(`[${requestId}] wrong content-type: ${reqContentType}`);
      return json(
        {
          error: `Envie multipart/form-data, não '${reqContentType || "vazio"}'`,
          receivedContentType: reqContentType,
        },
        400
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error(`[${requestId}] formData parse error`, e);
      return json(
        {
          error: "Body inválido (esperado multipart/form-data)",
          receivedContentType: reqContentType,
        },
        400
      );
    }

    const file = formData.get("file") as File | null;
    const context = (formData.get("context") as string) as GestaoContext;
    const entityId = (formData.get("entityId") as string) || undefined;

    if (!file) return json({ error: "Arquivo é obrigatório (campo 'file')" }, 400);
    const rule = GESTAO_RULES[context];
    if (!rule) return json({ error: `Contexto inválido: ${context}` }, 400);

    if (file.size > rule.maxBytes) {
      return json(
        { error: `Arquivo excede ${(rule.maxBytes / 1024 / 1024).toFixed(0)}MB` },
        400
      );
    }
    if (rule.allowedTypes && !rule.allowedTypes.includes(file.type)) {
      return json({ error: `Tipo não permitido: ${file.type || "desconhecido"}` }, 400);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const storagePath = `${rule.prefix(user.id, entityId)}/${filename}`;
    const fileData = await file.arrayBuffer();

    console.log(
      `[${requestId}] uploading user=${user.id} ctx=${context} bucket=${rule.bucket} path=${storagePath} size=${(fileData.byteLength / 1024).toFixed(0)}KB`
    );

    let creds;
    try {
      creds = getR2Creds();
    } catch (e) {
      console.error(`[${requestId}] R2 creds missing`, e);
      return json({ error: e instanceof Error ? e.message : "R2 credentials missing" }, 500);
    }

    try {
      await r2Put(creds, storagePath, fileData, file.type || "application/octet-stream", rule.bucket);
    } catch (e) {
      console.error(`[${requestId}] r2Put error`, e);
      return json({ error: e instanceof Error ? e.message : "Falha ao enviar para R2" }, 502);
    }

    const url = rule.isPublic ? `${R2_CDN_BASE}/${storagePath}` : "";
    console.log(`[${requestId}] ok ${storagePath}`);
    return json(
      {
        success: true,
        url,
        storagePath,
        isPublic: rule.isPublic,
        bucket: rule.bucket,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
      200
    );
  } catch (e) {
    console.error(`[${requestId}] fatal`, e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
