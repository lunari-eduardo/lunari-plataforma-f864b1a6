/**
 * payment-link-preview
 *
 * Serve HTML branded para crawlers (WhatsApp, LinkedIn, Facebook, Slack,
 * Telegram, Discord, iMessage, Google) e redireciona humanos para a página
 * real de pagamento (`/pay/ip/:id` ou `/checkout/:id`).
 *
 * Chamado via rewrite Vercel:
 *   /l/:cobrancaId → https://<sb>.functions.supabase.co/payment-link-preview?id=:cobrancaId
 *
 * PÚBLICO — verify_jwt = false. Nunca expõe user_id, email, telefone.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = (Deno.env.get("VITE_SITE_URL") || Deno.env.get("SITE_URL") || "https://app.lunarihub.com").replace(/\/$/, "");
const FALLBACK_OG_IMAGE = `${PUBLIC_SITE_URL}/og-fallback-cobranca.jpg`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_UA_RE = /(whatsapp|facebookexternalhit|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|skypeuripreview|googlebot|bingbot|preview|embedly|redditbot|pinterest|applebot|iframely|vkshare)/i;

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  "Vary": "User-Agent",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(v: string, max: number): string {
  const s = v.trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function firstName(nome: string | null | undefined): string | null {
  if (!nome) return null;
  const parts = nome.trim().split(/\s+/);
  return parts[0] || null;
}

function formatBRL(valor: number): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
  } catch {
    return `R$ ${valor.toFixed(2).replace(".", ",")}`;
  }
}

interface Ctx {
  title: string;
  desc: string;
  brandName: string;
  ogImageUrl: string;
  canonicalUrl: string;
  targetPath: string | null; // null = não redireciona (pago/cancelado/inválido)
  isBot: boolean;
  bodyMessage: string;
}

function renderHtml(c: Ctx): string {
  const redirectHead = c.targetPath
    ? `<meta http-equiv="refresh" content="0; url=${escapeHtml(c.targetPath)}"/>`
    : "";
  const redirectScript = c.targetPath && !c.isBot
    ? `<script>window.location.replace(${JSON.stringify(c.targetPath)});</script>`
    : "";
  const linkBack = c.targetPath
    ? `<a href="${escapeHtml(c.targetPath)}" style="color:#a78bfa;text-decoration:underline">continuar para o pagamento</a>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(c.title)}</title>
<meta name="description" content="${escapeHtml(c.desc)}"/>
<link rel="canonical" href="${escapeHtml(c.canonicalUrl)}"/>
<meta name="robots" content="noindex,nofollow"/>

<meta property="og:type" content="website"/>
<meta property="og:site_name" content="${escapeHtml(c.brandName)}"/>
<meta property="og:title" content="${escapeHtml(c.title)}"/>
<meta property="og:description" content="${escapeHtml(c.desc)}"/>
<meta property="og:url" content="${escapeHtml(c.canonicalUrl)}"/>
<meta property="og:image" content="${escapeHtml(c.ogImageUrl)}"/>
<meta property="og:image:secure_url" content="${escapeHtml(c.ogImageUrl)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="Logo de ${escapeHtml(c.brandName)}"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(c.title)}"/>
<meta name="twitter:description" content="${escapeHtml(c.desc)}"/>
<meta name="twitter:image" content="${escapeHtml(c.ogImageUrl)}"/>

${redirectHead}
${redirectScript}
<style>
  html,body{margin:0;padding:0;background:#0b0b0f;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
  .card{max-width:420px}
  .brand{font-size:14px;letter-spacing:.15em;text-transform:uppercase;color:#a78bfa;margin-bottom:12px}
  h1{font-size:22px;font-weight:500;margin:0 0 16px;line-height:1.35}
  p{color:#a3a3a3;font-size:15px;line-height:1.5;margin:0}
</style>
</head>
<body>
<div class="wrap"><div class="card">
  <div class="brand">${escapeHtml(c.brandName)}</div>
  <h1>${escapeHtml(c.bodyMessage)}</h1>
  <p>${linkBack}</p>
</div></div>
</body>
</html>`;
}

function renderInvalid(canonicalUrl: string, brandName = "Lunari"): Response {
  const html = renderHtml({
    title: "Link de pagamento não disponível",
    desc: "Este link de pagamento não foi encontrado ou já não está mais ativo.",
    brandName,
    ogImageUrl: FALLBACK_OG_IMAGE,
    canonicalUrl,
    targetPath: null,
    isBot: false,
    bodyMessage: "Link de pagamento não disponível",
  });
  return new Response(html, { status: 200, headers: HTML_HEADERS });
}

serve(async (req) => {
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") || "").trim().toLowerCase();
  const canonicalUrl = `${PUBLIC_SITE_URL}/l/${id}`;
  const userAgent = req.headers.get("user-agent") || "";
  const isBot = BOT_UA_RE.test(userAgent);

  if (!id || !UUID_RE.test(id)) {
    return renderInvalid(canonicalUrl);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: cobranca, error: cErr } = await supabase
      .from("cobrancas")
      .select("id, valor, descricao, status, provedor, user_id, cliente_id")
      .eq("id", id)
      .maybeSingle();

    if (cErr || !cobranca) {
      console.warn("[payment-link-preview] cobranca não encontrada", { id, cErr });
      return renderInvalid(canonicalUrl);
    }

    const [{ data: profile }, { data: cliente }] = await Promise.all([
      supabase.from("profiles").select("nome, empresa, logo_url").eq("user_id", cobranca.user_id).maybeSingle(),
      cobranca.cliente_id
        ? supabase.from("clientes").select("nome").eq("id", cobranca.cliente_id).maybeSingle()
        : Promise.resolve({ data: null as { nome: string | null } | null }),
    ]);

    const brandName = (profile?.empresa || profile?.nome || "Lunari").toString().trim() || "Lunari";
    const ogImageUrl = (profile?.logo_url || "").trim() || FALLBACK_OG_IMAGE;
    const valorFmt = formatBRL(Number(cobranca.valor || 0));
    const primeiroNome = firstName(cliente?.nome);
    const descRaw = (cobranca.descricao || "").toString().trim();

    // Mapa provedor → rota real do checkout
    const targetPath = cobranca.provedor === "infinitepay"
      ? `/pay/ip/${cobranca.id}`
      : `/checkout/${cobranca.id}`;

    let title: string;
    let desc: string;
    let bodyMessage: string;
    let redirectTarget: string | null = targetPath;

    if (cobranca.status === "pago") {
      title = `Pagamento concluído — ${brandName}`;
      desc = `Cobrança de ${valorFmt} paga com sucesso.`;
      bodyMessage = "Pagamento concluído";
      redirectTarget = null;
    } else if (cobranca.status === "cancelado" || cobranca.status === "expirado") {
      title = `Link não disponível — ${brandName}`;
      desc = "Este link de pagamento não está mais ativo.";
      bodyMessage = "Link de pagamento não disponível";
      redirectTarget = null;
    } else {
      const saudacao = primeiroNome ? `Olá, ${primeiroNome}! ` : "";
      const descSuffix = descRaw ? ` — ${truncate(descRaw, 90)}` : "";
      title = `Pagamento para ${brandName} — ${valorFmt}`;
      desc = `${saudacao}Sua cobrança de ${valorFmt}${descSuffix}. Pague com PIX, cartão ou boleto em ambiente seguro.`;
      bodyMessage = `Redirecionando para o pagamento de ${valorFmt}…`;
    }

    const html = renderHtml({
      title,
      desc,
      brandName,
      ogImageUrl,
      canonicalUrl,
      targetPath: redirectTarget,
      isBot,
      bodyMessage,
    });

    return new Response(html, { status: 200, headers: HTML_HEADERS });
  } catch (err) {
    console.error("[payment-link-preview] erro", err);
    return renderInvalid(canonicalUrl);
  }
});
