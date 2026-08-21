import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = (Deno.env.get("VITE_SITE_URL") || Deno.env.get("SITE_URL") || "https://app.lunarihub.com").replace(/\/$/, "");
const FALLBACK_OG_IMAGE = `${PUBLIC_SITE_URL}/branding/logo-site-gold.png`;

const BOT_UA_RE = /(whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|telegrambot|discordbot|skypeuripreview|googlebot|google-inspectiontool|bingbot|yandexbot|duckduckbot|preview|embedly|redditbot|pinterest|applebot|iframely|vkshare|snapchat|line-poker|nuzzel|qwantify|baiduspider|msnbot|mediapartners-google|whatsapp-preview|w3c_validator|opengraph|metatags)/i;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

const BOT_HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400",
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

interface BrandedPreviewCtx {
  title: string;
  desc: string;
  brandName: string;
  ogImageUrl: string;
  canonicalUrl: string;
}

function renderHtml(c: BrandedPreviewCtx): string {
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
<meta property="og:image:alt" content="${escapeHtml(c.title)}"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(c.title)}"/>
<meta name="twitter:description" content="${escapeHtml(c.desc)}"/>
<meta name="twitter:image" content="${escapeHtml(c.ogImageUrl)}"/>

<style>
  html,body{margin:0;padding:0;background:#0E0E0E;color:#FAF9F7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
  .card{max-width:440px}
  .brand{font-size:14px;letter-spacing:.15em;text-transform:uppercase;color:#C6A36A;margin-bottom:12px;font-weight:600}
  h1{font-size:22px;font-weight:500;margin:0 0 16px;line-height:1.35}
  p{color:#A3A3A3;font-size:15px;line-height:1.5;margin:0}
</style>
</head>
<body>
<div class="wrap"><div class="card">
  <div class="brand">${escapeHtml(c.brandName)}</div>
  <h1>${escapeHtml(c.title)}</h1>
  <p>${escapeHtml(c.desc)}</p>
</div></div>
</body>
</html>`;
}

serve(async (req) => {
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "").trim().toLowerCase();
  const token = (url.searchParams.get("token") || "").trim();
  const slug = (url.searchParams.get("slug") || "").trim();

  let targetPath = "/";
  if (type === "form") targetPath = `/formulario/${token}`;
  else if (type === "proposal" && token) targetPath = `/p/${token}`;
  else if (type === "proposal" && slug) targetPath = `/${slug}`;

  const canonicalUrl = `${PUBLIC_SITE_URL}${targetPath}`;
  const userAgent = req.headers.get("user-agent") || "";
  const accept = req.headers.get("accept") || "";
  const isBot = BOT_UA_RE.test(userAgent);
  const wantsHtml = accept.includes("text/html") || accept.includes("*/*") || accept === "";
  const treatAsBot = isBot || !wantsHtml;

  // ─────────────────────────────────────────────────────────────
  // Ramo HUMANO (Navegador) — Redireciona 302 direto para a SPA
  // ─────────────────────────────────────────────────────────────
  if (!treatAsBot) {
    return new Response(null, {
      status: 302,
      headers: {
        ...NO_STORE_HEADERS,
        Location: canonicalUrl,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Ramo BOT / CRAWLER (WhatsApp, etc.) — Retorna HTML estático
  // ─────────────────────────────────────────────────────────────
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let title = "Fotografia";
    let desc = "Acesse o link para mais informações.";
    let brandName = "Fotografia";
    let ogImageUrl = FALLBACK_OG_IMAGE;

    if (type === "form" && token) {
      const { data: form } = await supabase
        .from("formularios")
        .select("id, user_id, titulo, titulo_cliente, descricao")
        .eq("public_token", token)
        .maybeSingle();

      if (form) {
        const [{ data: settings }, { data: profile }] = await Promise.all([
          supabase.from("gallery_settings").select("studio_name, studio_logo_url").eq("user_id", form.user_id).maybeSingle(),
          supabase.from("profiles").select("nome, empresa, logo_url, avatar_url").eq("user_id", form.user_id).maybeSingle(),
        ]);

        const studioCandidate = (settings?.studio_name || "").trim();
        const companyCandidate = (profile?.empresa || "").trim();
        const nameCandidate = (profile?.nome || "").trim();

        if (studioCandidate && studioCandidate !== "Meu Estúdio") brandName = studioCandidate;
        else if (companyCandidate) brandName = companyCandidate;
        else if (nameCandidate) brandName = nameCandidate;

        const candidateLogo = (profile?.logo_url || settings?.studio_logo_url || profile?.avatar_url || "").trim();
        ogImageUrl = (candidateLogo.startsWith("http://") || candidateLogo.startsWith("https://")) ? candidateLogo : FALLBACK_OG_IMAGE;

        const formTitle = (form.titulo_cliente || form.titulo || "Formulário").toString().trim();
        title = `${formTitle} — ${brandName}`;
        desc = (form.descricao || "Por favor, preencha este formulário para alinharmos os detalhes do seu ensaio.").toString().trim();
      }
    } else if (type === "proposal" && token) {
      const { data: share } = await supabase
        .from("material_shares")
        .select("id, material_id, user_id")
        .eq("token", token)
        .maybeSingle();

      if (share) {
        const [{ data: material }, { data: settings }, { data: profile }] = await Promise.all([
          supabase.from("commercial_materials").select("title, cover_image_url").eq("id", share.material_id).maybeSingle(),
          supabase.from("gallery_settings").select("studio_name, studio_logo_url").eq("user_id", share.user_id).maybeSingle(),
          supabase.from("profiles").select("nome, empresa, logo_url, avatar_url").eq("user_id", share.user_id).maybeSingle(),
        ]);

        const studioCandidate = (settings?.studio_name || "").trim();
        const companyCandidate = (profile?.empresa || "").trim();
        const nameCandidate = (profile?.nome || "").trim();

        if (studioCandidate && studioCandidate !== "Meu Estúdio") brandName = studioCandidate;
        else if (companyCandidate) brandName = companyCandidate;
        else if (nameCandidate) brandName = nameCandidate;

        const candidateImg = (material?.cover_image_url || profile?.logo_url || settings?.studio_logo_url || profile?.avatar_url || "").trim();
        ogImageUrl = (candidateImg.startsWith("http://") || candidateImg.startsWith("https://")) ? candidateImg : FALLBACK_OG_IMAGE;

        const proposalTitle = (material?.title || "Proposta").toString().trim();
        title = `${proposalTitle} — ${brandName}`;
        desc = "Confira a proposta exclusiva preparada especialmente para você.";
      }
    } else if (type === "proposal" && slug) {
      const { data: shareLink } = await supabase
        .from("material_share_links")
        .select("id, material_id, user_id")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();

      if (shareLink) {
        const [{ data: material }, { data: settings }, { data: profile }] = await Promise.all([
          supabase.from("commercial_materials").select("title, cover_image_url").eq("id", shareLink.material_id).maybeSingle(),
          supabase.from("gallery_settings").select("studio_name, studio_logo_url").eq("user_id", shareLink.user_id).maybeSingle(),
          supabase.from("profiles").select("nome, empresa, logo_url, avatar_url").eq("user_id", shareLink.user_id).maybeSingle(),
        ]);

        const studioCandidate = (settings?.studio_name || "").trim();
        const companyCandidate = (profile?.empresa || "").trim();
        const nameCandidate = (profile?.nome || "").trim();

        if (studioCandidate && studioCandidate !== "Meu Estúdio") brandName = studioCandidate;
        else if (companyCandidate) brandName = companyCandidate;
        else if (nameCandidate) brandName = nameCandidate;

        const candidateImg = (material?.cover_image_url || profile?.logo_url || settings?.studio_logo_url || profile?.avatar_url || "").trim();
        ogImageUrl = (candidateImg.startsWith("http://") || candidateImg.startsWith("https://")) ? candidateImg : FALLBACK_OG_IMAGE;

        const proposalTitle = (material?.title || "Proposta").toString().trim();
        title = `${proposalTitle} — ${brandName}`;
        desc = "Confira a proposta exclusiva preparada para você.";
      }
    }

    const html = renderHtml({
      title,
      desc,
      brandName,
      ogImageUrl,
      canonicalUrl,
    });

    return new Response(html, {
      status: 200,
      headers: BOT_HTML_HEADERS,
    });
  } catch (err) {
    console.error("[public-link-preview] error:", err);
    return new Response(renderHtml({
      title: "Fotografia",
      desc: "Acesse o link para conferir as informações.",
      brandName: "Fotografia",
      ogImageUrl: FALLBACK_OG_IMAGE,
      canonicalUrl,
    }), { status: 200, headers: BOT_HTML_HEADERS });
  }
});
