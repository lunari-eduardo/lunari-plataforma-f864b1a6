// Envia e-mail transacional via Resend Gateway notificando um signatário
// (normalmente o próprio fotógrafo, já que a Autentique não envia e-mail
// para o dono da conta da API).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend/emails";

interface Body {
  contrato_id: string;
  signer_email: string;
  link: string;
  tipo?: "envio" | "lembrete";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // JWT obrigatório (chamado tanto pelo front quanto por outras edge functions
    // que reenviam o header).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jerr("UNAUTHORIZED", "Não autenticado", 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supa.auth.getClaims(token);
    if (cErr || !claims?.claims) return jerr("UNAUTHORIZED", "Sessão inválida", 401);
    const userId = claims.claims.sub as string;

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const contratoId = String(body.contrato_id || "");
    const signerEmail = String(body.signer_email || "").trim();
    const link = String(body.link || "").trim();
    const tipo = body.tipo || "envio";

    if (!contratoId || !signerEmail || !link) {
      return jerr("INVALID_INPUT", "contrato_id, signer_email e link são obrigatórios", 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: contrato } = await admin
      .from("contratos")
      .select("id, user_id, titulo, cliente:clientes(nome)")
      .eq("id", contratoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!contrato) return jerr("NOT_FOUND", "Contrato não encontrado", 404);

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return jerr("EMAIL_DISABLED", "Gateway de e-mail indisponível", 500);

    const clienteNome = (contrato as any).cliente?.nome || "seu cliente";
    const titulo = contrato.titulo || "Contrato";

    const subject =
      tipo === "lembrete"
        ? `Lembrete: contrato pendente de assinatura — ${titulo}`
        : `Você recebeu um contrato para assinar — ${titulo}`;

    const intro =
      tipo === "lembrete"
        ? `<strong>${clienteNome}</strong> já assinou o contrato. Falta apenas a sua assinatura para finalizar.`
        : `Um contrato com <strong>${clienteNome}</strong> está pronto para sua assinatura na Autentique.`;

    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
        <tr><td style="padding:28px 32px 8px;">
          <div style="font-size:13px;color:#6b7280;letter-spacing:.04em;text-transform:uppercase;">Lunari · Contratos</div>
          <h1 style="margin:8px 0 0;font-size:20px;font-weight:600;color:#111827;">${escapeHtml(titulo)}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 0;font-size:15px;line-height:1.6;color:#374151;">
          <p style="margin:8px 0 0;">${intro}</p>
          <p style="margin:16px 0 0;">Clique no botão abaixo para revisar e assinar digitalmente:</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <a href="${link}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">Assinar contrato</a>
        </td></tr>
        <tr><td style="padding:0 32px 24px;font-size:13px;color:#6b7280;line-height:1.6;">
          <p style="margin:0 0 8px;">Se o botão não funcionar, copie e cole este link no navegador:</p>
          <p style="margin:0;word-break:break-all;"><a href="${link}" style="color:#2563eb;">${link}</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af;">
          Você está recebendo este e-mail porque é signatário deste contrato.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const res = await fetch(RESEND_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        from: "Lunari <onboarding@resend.dev>",
        to: [signerEmail],
        subject,
        html,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[autentique-notify-signer] resend error", res.status, json);
      return jerr("EMAIL_SEND_FAILED", json?.message || `Falha no envio (${res.status})`, 400);
    }

    // Marca o lembrete em dados_extras para evitar spam
    if (tipo === "lembrete") {
      const { data: cur } = await admin
        .from("contratos")
        .select("observacoes")
        .eq("id", contratoId)
        .maybeSingle();
      const meta = parseMeta(cur?.observacoes);
      meta.last_reminder_at = new Date().toISOString();
      meta.reminder_count = (meta.reminder_count || 0) + 1;
      await admin
        .from("contratos")
        .update({ observacoes: writeMeta(cur?.observacoes, meta) })
        .eq("id", contratoId);
    }

    return jres({ success: true, id: json?.id });
  } catch (e: any) {
    console.error("[autentique-notify-signer] error", e);
    return jerr("INTERNAL", e?.message || "Erro interno", 500);
  }
});

function jres(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jerr(code: string, message: string, status = 400) {
  return jres({ error: { code, message } }, status);
}
function escapeHtml(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
// Lembretes: armazenamos um pequeno JSON em observacoes prefixado por __META__
function parseMeta(obs?: string | null): Record<string, any> {
  if (!obs) return {};
  const m = obs.match(/__META__:(\{.*?\})__\/META__/s);
  if (!m) return {};
  try {
    return JSON.parse(m[1]);
  } catch {
    return {};
  }
}
function writeMeta(obs: string | null | undefined, meta: Record<string, any>): string {
  const cleaned = (obs || "").replace(/__META__:\{.*?\}__\/META__/s, "").trim();
  return `${cleaned}\n__META__:${JSON.stringify(meta)}__/META__`.trim();
}
