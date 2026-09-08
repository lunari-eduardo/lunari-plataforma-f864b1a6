import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';

export async function contractsNativeGetRoute(c: Context<{ Bindings: Bindings }>) {
  try {
    const signatureToken = c.req.param("token");
    if (!signatureToken) {
      return c.json({ error: "Token inválido" }, 400);
    }

    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: contrato, error: contratoErr } = await supabase
      .from("contratos")
      .select(`
        id, 
        titulo, 
        conteudo,
        status, 
        created_at,
        assinado_em,
        original_file_path,
        arquivo_assinado_path,
        user_id,
        cliente:clientes(nome, email, documento)
      `)
      .eq("signature_token", signatureToken)
      .single();

    if (contratoErr || !contrato) {
      return c.json({ error: "Contrato não encontrado ou link expirado/inválido" }, 404);
    }

    // Buscar informações do profissional/fotógrafo
    const { data: prof } = await supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", contrato.user_id)
      .maybeSingle();

    return c.json({
      success: true,
      contrato: {
        id: contrato.id,
        titulo: contrato.titulo,
        conteudo: contrato.conteudo,
        status: contrato.status,
        created_at: contrato.created_at,
        assinado_em: contrato.assinado_em,
        has_pdf: !!(contrato.arquivo_assinado_path || contrato.original_file_path),
        download_url: `/api/contracts/native/download/${signatureToken}`,
        cliente: {
          nome: Array.isArray(contrato.cliente) ? contrato.cliente[0]?.nome : contrato.cliente?.nome,
          documento: Array.isArray(contrato.cliente) ? contrato.cliente[0]?.documento : contrato.cliente?.documento
        },
        fotografo: {
          nome: prof?.nome || "Fotógrafo"
        }
      }
    });

  } catch (e: any) {
    console.error("[contracts-native-get] error", e);
    return c.json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
}
