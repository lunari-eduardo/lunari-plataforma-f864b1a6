import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';

export async function contractsNativeDownloadRoute(c: Context<{ Bindings: Bindings }>) {
  try {
    const token = c.req.param("token");
    if (!token) return c.text("Token inválido", 400);

    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: contrato, error } = await supabase
      .from("contratos")
      .select("id, titulo, status, arquivo_assinado_path, original_file_path")
      .eq("signature_token", token)
      .single();

    if (error || !contrato) {
      return c.text("Contrato não encontrado", 404);
    }

    // Se já foi assinado, baixa o final com auditoria. Se não, baixa o original.
    const storagePath = (contrato.status === 'assinado' && contrato.arquivo_assinado_path)
      ? contrato.arquivo_assinado_path
      : contrato.original_file_path;

    if (!storagePath) {
      return c.text("Arquivo PDF não disponível", 404);
    }

    const object = await c.env.LUNARI_PRIVATE.get(storagePath);
    if (!object) {
      return c.text("Arquivo não localizado no armazenamento R2", 404);
    }

    const sanitizedTitle = (contrato.titulo || "contrato")
      .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
      .substring(0, 50);

    const filename = contrato.status === 'assinado' 
      ? `${sanitizedTitle}-assinado.pdf` 
      : `${sanitizedTitle}.pdf`;

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `inline; filename="${filename}"`);
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

    return new Response(object.body, { headers });
  } catch (e: any) {
    console.error("[contracts-native-download] error", e);
    return c.text(e instanceof Error ? e.message : "Erro interno", 500);
  }
}
