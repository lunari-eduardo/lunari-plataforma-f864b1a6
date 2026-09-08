import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';

export async function contractsNativeSendRoute(c: Context<{ Bindings: Bindings }>) {
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

    const body = await c.req.json().catch(() => ({}));
    const contratoId = body.contrato_id;
    const pdfBase64 = body.pdf_base64;

    if (!contratoId || !pdfBase64) {
      return c.json({ error: "contrato_id e pdf_base64 são obrigatórios" }, 400);
    }

    // 1. Get Contract
    const { data: contrato, error: contratoErr } = await supabase
      .from("contratos")
      .select("id, user_id, status")
      .eq("id", contratoId)
      .eq("user_id", user.id)
      .single();

    if (contratoErr || !contrato) {
      return c.json({ error: "Contrato não encontrado" }, 404);
    }

    if (contrato.status === 'assinado') {
      return c.json({ error: "Contrato já está assinado" }, 400);
    }

    // 2. Decode PDF Base64
    const cleanBase64 = pdfBase64.replace(/^data:.*;base64,/, "");
    const pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));

    // 3. Upload to R2 (LUNARI_PRIVATE)
    const storagePath = `gestao/contratos-assinados/${user.id}/${contrato.id}/original.pdf`;
    
    await c.env.LUNARI_PRIVATE.put(storagePath, pdfBytes.buffer, {
      httpMetadata: {
        contentType: "application/pdf",
        contentDisposition: "inline",
      },
    });

    // 4. Update Supabase
    const { data: updatedContrato, error: updateErr } = await supabase
      .from("contratos")
      .update({
        signature_provider: "native",
        status: "enviado",
        enviado_em: new Date().toISOString(),
        original_file_path: storagePath
      })
      .eq("id", contrato.id)
      .select("signature_token")
      .single();

    if (updateErr || !updatedContrato) {
      return c.json({ error: "Erro ao atualizar status do contrato: " + updateErr?.message }, 500);
    }

    // Email dispatcher can be called by frontend to keep responsibilities separate.
    return c.json({
      success: true,
      signature_token: updatedContrato.signature_token,
      storagePath
    });
  } catch (e: any) {
    console.error("[contracts-native-send] error", e);
    return c.json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
}
