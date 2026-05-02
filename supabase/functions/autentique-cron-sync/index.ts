// Cron de sincronização automática com a Autentique.
// Roda periodicamente (ex: a cada 5 min) e atualiza todos os contratos
// que estão "enviado" e ainda não foram concluídos. Não exige config de
// webhook por parte do usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AUTENTIQUE_URL = "https://api.autentique.com.br/v2/graphql";
const MAX_CONTRATOS_POR_RUN = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pega contratos ativos (enviados na Autentique e ainda não finalizados)
    const { data: contratos, error: cErr } = await admin
      .from("contratos")
      .select("id, user_id, titulo, signature_external_id, status, observacoes, enviado_em")
      .not("signature_external_id", "is", null)
      .in("status", ["enviado", "rascunho"])
      .order("updated_at", { ascending: true })
      .limit(MAX_CONTRATOS_POR_RUN);

    if (cErr) throw cErr;
    if (!contratos || contratos.length === 0) {
      return jres({ success: true, processed: 0, updated: 0 });
    }

    // Cache de api keys por user_id
    const keyCache = new Map<string, string | null>();
    async function getKey(userId: string): Promise<string | null> {
      if (keyCache.has(userId)) return keyCache.get(userId)!;
      const { data } = await admin
        .from("usuarios_integracoes")
        .select("access_token")
        .eq("user_id", userId)
        .eq("provedor", "autentique")
        .eq("status", "conectado")
        .maybeSingle();
      const key = data?.access_token || null;
      keyCache.set(userId, key);
      return key;
    }

    let updated = 0;
    let errors = 0;

    for (const contrato of contratos) {
      try {
        const apiKey = await getKey(contrato.user_id);
        if (!apiKey) continue;

        const result = await syncOne({ admin, apiKey, contrato });
        if (result.changed) updated++;
      } catch (e) {
        errors++;
        console.error("[autentique-cron-sync] erro contrato", contrato.id, e);
      }
    }

    return jres({
      success: true,
      processed: contratos.length,
      updated,
      errors,
    });
  } catch (e: any) {
    console.error("[autentique-cron-sync] fatal", e);
    return jres({ success: false, error: e?.message || "erro" }, 500);
  }
});

async function syncOne({
  admin,
  apiKey,
  contrato,
}: {
  admin: any;
  apiKey: string;
  contrato: { id: string; user_id: string; titulo: string; signature_external_id: string; status: string; observacoes?: string | null; enviado_em?: string | null };
}) {
  const query = `
    query GetDocument($id: UUID!) {
      document(id: $id) {
        id name signed_count
        files { signed original }
        signatures {
          public_id name email
          signed { created_at }
          rejected { created_at }
          viewed { created_at }
          link { short_link }
          action { name }
        }
      }
    }
  `;

  const res = await fetch(AUTENTIQUE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { id: contrato.signature_external_id } }),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || json?.errors || !json?.data?.document) {
    return { changed: false };
  }

  const doc = json.data.document;
  const sigs: any[] = doc.signatures || [];
  const signersOut = sigs.map((s) => {
    let status: "assinado" | "recusado" | "visualizado" | "pendente" = "pendente";
    let timestamp: string | null = null;
    if (s.signed?.created_at) { status = "assinado"; timestamp = s.signed.created_at; }
    else if (s.rejected?.created_at) { status = "recusado"; timestamp = s.rejected.created_at; }
    else if (s.viewed?.created_at) { status = "visualizado"; timestamp = s.viewed.created_at; }
    return {
      public_id: s.public_id,
      email: s.email,
      nome: s.name,
      papel: s.action?.name,
      link: s.link?.short_link,
      status,
      timestamp,
    };
  });

  const allSigned = signersOut.length > 0 && signersOut.every((s) => s.status === "assinado");
  const anyRejected = signersOut.some((s) => s.status === "recusado");

  const patch: any = { signers: signersOut };

  if (anyRejected) {
    patch.status = "cancelado";
  } else if (allSigned) {
    patch.status = "assinado";
    const lastSigned = signersOut.map((s) => s.timestamp).filter(Boolean).sort().pop();
    patch.assinado_em = lastSigned || new Date().toISOString();

    const signedUrl = doc.files?.signed;
    if (signedUrl) {
      try {
        const pdfRes = await fetch(signedUrl);
        if (pdfRes.ok) {
          const pdfBuf = await pdfRes.arrayBuffer();
          const path = `contratos-assinados/${contrato.user_id}/${contrato.id}/autentique-${doc.id}.pdf`;
          const { r2Put, getR2Creds } = await import("../_shared/r2.ts");
          try {
            await r2Put(getR2Creds(), path, pdfBuf, "application/pdf");
            patch.arquivo_assinado_path = path;
            patch.r2_arquivo_assinado_path = path;
            patch.arquivo_assinado_nome = `${contrato.titulo || "contrato"}-assinado.pdf`;
            patch.arquivo_assinado_tamanho = pdfBuf.byteLength;
          } catch (e) {
            console.error("[autentique-cron-sync] R2 upload falhou", e);
          }
        }
      } catch (e) {
        console.error("[autentique-cron-sync] download pdf falhou", e);
      }
    }
  } else {
    // Lembrete: se há ALGUM signatário assinado e ALGUM pendente há > 1h,
    // notificamos os pendentes (limita a 1 lembrete por dia por contrato).
    await maybeSendReminder({ admin, contrato, signers: signersOut });
  }

  const { error: upErr } = await admin
    .from("contratos")
    .update(patch)
    .eq("id", contrato.id);
  if (upErr) {
    console.error("[autentique-cron-sync] update falhou", contrato.id, upErr);
    return { changed: false };
  }

  return { changed: true };
}

async function maybeSendReminder({
  admin,
  contrato,
  signers,
}: {
  admin: any;
  contrato: { id: string; observacoes?: string | null; enviado_em?: string | null };
  signers: any[];
}) {
  const algumAssinou = signers.some((s) => s.status === "assinado");
  if (!algumAssinou) return; // só lembra depois que a primeira parte assinou

  const pendentes = signers.filter((s) => s.status !== "assinado" && s.status !== "recusado" && s.link);
  if (pendentes.length === 0) return;

  // Rate limit: 1 lembrete a cada 24h
  const meta = parseMeta(contrato.observacoes);
  const lastReminder = meta.last_reminder_at ? new Date(meta.last_reminder_at).getTime() : 0;
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (now - lastReminder < ONE_DAY) return;

  // E só dispara se passou > 1h desde o envio
  const enviadoEm = contrato.enviado_em ? new Date(contrato.enviado_em).getTime() : now;
  const ONE_HOUR = 60 * 60 * 1000;
  if (now - enviadoEm < ONE_HOUR) return;

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return;

  // Envia direto pelo gateway (sem JWT, pois é background job)
  for (const s of pendentes) {
    try {
      await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          from: "Lunari <onboarding@resend.dev>",
          to: [s.email],
          subject: `Lembrete: assinatura pendente`,
          html: `<p>Olá ${s.nome || ""},</p>
            <p>Você ainda não assinou o contrato. As outras partes já assinaram e estão aguardando.</p>
            <p><a href="${s.link}" style="display:inline-block;background:#111827;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Assinar agora</a></p>
            <p style="font-size:12px;color:#6b7280;">Se o botão não funcionar, copie este link: <br>${s.link}</p>`,
        }),
      });
    } catch (e) {
      console.error("[cron-sync] reminder failed for", s.email, e);
    }
  }

  // Marca lembrete enviado
  meta.last_reminder_at = new Date().toISOString();
  meta.reminder_count = (meta.reminder_count || 0) + 1;
  await admin
    .from("contratos")
    .update({ observacoes: writeMeta(contrato.observacoes, meta) })
    .eq("id", contrato.id);
}

function parseMeta(obs?: string | null): Record<string, any> {
  if (!obs) return {};
  const m = obs.match(/__META__:(\{.*?\})__\/META__/s);
  if (!m) return {};
  try { return JSON.parse(m[1]); } catch { return {}; }
}
function writeMeta(obs: string | null | undefined, meta: Record<string, any>): string {
  const cleaned = (obs || "").replace(/__META__:\{.*?\}__\/META__/s, "").trim();
  return `${cleaned}\n__META__:${JSON.stringify(meta)}__/META__`.trim();
}

function jres(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
