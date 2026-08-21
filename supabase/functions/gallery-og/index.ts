import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = (Deno.env.get("VITE_SITE_URL") || Deno.env.get("SITE_URL") || "https://app.lunarihub.com").replace(/\/$/, "");
const R2_PUBLIC_URL = "https://media.lunarihub.com";
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

function truncate(v: string, max: number): string {
  const s = v.trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

interface BrandedPreviewCtx {
  title: string;
  desc: string;
  brandName: string;
  ogImageUrl: string;
  canonicalUrl: string;
  imgWidth?: number;
  imgHeight?: number;
}

function renderHtml(c: BrandedPreviewCtx): string {
  const width = c.imgWidth || 1200;
  const height = c.imgHeight || 630;

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
<meta property="og:image:width" content="${width}"/>
<meta property="og:image:height" content="${height}"/>
<meta property="og:image:alt" content="${escapeHtml(c.title)}"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(c.title)}"/>
<meta name="twitter:description" content="${escapeHtml(c.desc)}"/>
<meta name="twitter:image" content="${escapeHtml(c.ogImageUrl)}"/>

<style>
  html,body{margin:0;padding:0;background:#0E0E0E;color:#FAF9F7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
  .card{max-width:440px;background:#18181b;padding:32px 24px;border-radius:16px;border:1px solid #27272a}
  .brand{font-size:14px;letter-spacing:.15em;text-transform:uppercase;color:#C6A36A;margin-bottom:12px;font-weight:600}
  h1{font-size:22px;font-weight:500;margin:0 0 16px;line-height:1.35}
  p{color:#A3A3A3;font-size:15px;line-height:1.5;margin:0 0 24px}
  .btn{display:inline-block;padding:12px 28px;background:#C6A36A;color:#0E0E0E;font-weight:600;text-decoration:none;border-radius:8px;font-size:14px;transition:opacity 0.2s}
  .btn:hover{opacity:0.9}
</style>
</head>
<body>
<div class="wrap"><div class="card">
  <div class="brand">${escapeHtml(c.brandName)}</div>
  <h1>${escapeHtml(c.title)}</h1>
  <p>${escapeHtml(c.desc)}</p>
  <a class="btn" href="${escapeHtml(c.canonicalUrl)}">Acessar Galeria</a>
</div></div>
</body>
</html>`;
}

serve(async (req) => {
  const url = new URL(req.url);
  const typeParam = (url.searchParams.get("type") || "").trim().toLowerCase();
  const token = (url.searchParams.get("token") || "").trim();
  const slug = (url.searchParams.get("slug") || "").trim();

  let targetPath = `/g/${token}`;
  if (typeParam === "deliver") targetPath = `/c/${token}`;
  else if (typeParam === "form") targetPath = `/formulario/${token}`;
  else if (typeParam === "proposal" && token) targetPath = `/p/${token}`;
  else if (typeParam === "proposal" && slug) targetPath = `/${slug}`;

  const canonicalUrl = `${PUBLIC_SITE_URL}${targetPath}`;

  // ─────────────────────────────────────────────────────────────
  // Ramo BOT / CRAWLER (WhatsApp, etc.) — Retorna HTML estático
  // ─────────────────────────────────────────────────────────────
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let ogTitle = "Fotografia";
    let ogDescription = "Clique e veja as informações.";
    let brandName = "Fotografia";
    let ogImageUrl: string | null = null;
    let imgWidth = 1200;
    let imgHeight = 630;

    if (typeParam === "form" && token) {
      // FORMULÁRIOS PÚBLICOS
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
        ogTitle = `${formTitle} — ${brandName}`;
        ogDescription = (form.descricao || "Por favor, preencha este formulário para alinharmos os detalhes do seu ensaio.").toString().trim();
      }
    } else if (typeParam === "proposal" && (token || slug)) {
      // PROPOSTAS COMERCIAIS
      let materialId: string | null = null;
      let userId: string | null = null;

      if (token) {
        const { data: share } = await supabase
          .from("material_shares")
          .select("material_id, user_id")
          .eq("token", token)
          .maybeSingle();
        materialId = share?.material_id || null;
        userId = share?.user_id || null;
      } else if (slug) {
        const { data: shareLink } = await supabase
          .from("material_share_links")
          .select("material_id, user_id")
          .eq("slug", slug.toLowerCase())
          .maybeSingle();
        materialId = shareLink?.material_id || null;
        userId = shareLink?.user_id || null;
      }

      if (materialId && userId) {
        const [{ data: material }, { data: settings }, { data: profile }] = await Promise.all([
          supabase.from("commercial_materials").select("title, cover_image_url").eq("id", materialId).maybeSingle(),
          supabase.from("gallery_settings").select("studio_name, studio_logo_url").eq("user_id", userId).maybeSingle(),
          supabase.from("profiles").select("nome, empresa, logo_url, avatar_url").eq("user_id", userId).maybeSingle(),
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
        ogTitle = `${proposalTitle} — ${brandName}`;
        ogDescription = "Confira a proposta exclusiva preparada especialmente para você.";
      }
    } else {
      // GALERIAS DE SELEÇÃO (/g/:token) E ENTREGA (/c/:token)
      let { data: gallery, error: galErr } = await supabase
        .from("galerias")
        .select("id, user_id, nome_sessao, tipo, status, status_selecao, cliente_nome, cover_storage_key, first_photo_storage_key, configuracoes, mensagem_boas_vindas")
        .eq("public_token", token)
        .maybeSingle();

      if (!gallery && !galErr) {
        const { data: legacyGal } = await supabase
          .from("galerias")
          .select("id, user_id, nome_sessao, tipo, status, status_selecao, cliente_nome, cover_storage_key, first_photo_storage_key, configuracoes, mensagem_boas_vindas")
          .eq("id", token)
          .maybeSingle();
        gallery = legacyGal;
      }

      if (!gallery) {
        return new Response(renderHtml({
          title: "Galeria não encontrada",
          desc: "Esta galeria de fotos não foi encontrada ou não está disponível.",
          brandName: "Fotografia",
          ogImageUrl: FALLBACK_OG_IMAGE,
          canonicalUrl,
        }), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE_HEADERS } });
      }

      const [{ data: settings }, { data: profile }] = await Promise.all([
        supabase
          .from("gallery_settings")
          .select("studio_name, studio_logo_url")
          .eq("user_id", gallery.user_id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("nome, empresa, logo_url, avatar_url")
          .eq("user_id", gallery.user_id)
          .maybeSingle(),
      ]);

      const studioCandidate = (settings?.studio_name || "").trim();
      const companyCandidate = (profile?.empresa || "").trim();
      const nameCandidate = (profile?.nome || "").trim();

      if (studioCandidate && studioCandidate !== "Meu Estúdio") {
        brandName = studioCandidate;
      } else if (companyCandidate) {
        brandName = companyCandidate;
      } else if (nameCandidate) {
        brandName = nameCandidate;
      }

      // ─────────────────────────────────────────────────────────────
      // Obter imagem de capa da galeria (R2 CDN) para card grande
      // ─────────────────────────────────────────────────────────────
      if (gallery.cover_storage_key) {
        const cleanKey = gallery.cover_storage_key.replace(/^\//, "");
        ogImageUrl = cleanKey.startsWith("http") ? cleanKey : `${R2_PUBLIC_URL}/${cleanKey}`;
      } else if (gallery.first_photo_storage_key) {
        const cleanKey = gallery.first_photo_storage_key.replace(/^\//, "");
        ogImageUrl = cleanKey.startsWith("http") ? cleanKey : `${R2_PUBLIC_URL}/${cleanKey}`;
      } else {
        const { data: photo } = await supabase
          .from("galeria_fotos")
          .select("preview_path, storage_key, thumb_path, width, height")
          .eq("galeria_id", gallery.id)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (photo) {
          const key = photo.preview_path || photo.storage_key || photo.thumb_path;
          if (key) {
            const cleanKey = key.replace(/^\//, "");
            ogImageUrl = cleanKey.startsWith("http") ? cleanKey : `${R2_PUBLIC_URL}/${cleanKey}`;
            if (photo.width && photo.height) {
              imgWidth = photo.width;
              imgHeight = photo.height;
            }
          }
        }
      }

      if (!ogImageUrl) {
        const candidateLogo = (profile?.logo_url || settings?.studio_logo_url || profile?.avatar_url || "").trim();
        if (candidateLogo.startsWith("http://") || candidateLogo.startsWith("https://")) {
          ogImageUrl = candidateLogo;
        } else {
          ogImageUrl = FALLBACK_OG_IMAGE;
        }
      }

      const sessionName = (gallery.nome_sessao || "Sessão de Fotos").toString().trim();
      const isDeliver = typeParam === "deliver" || gallery.tipo === "transfer" || gallery.tipo === "deliver";

      if (isDeliver) {
        ogTitle = sessionName ? `${sessionName} • Entrega de Fotos` : "Entrega de Fotos";
        ogDescription = (gallery.mensagem_boas_vindas || "").trim() || "Suas fotos em alta resolução estão prontas para visualização e download!";
      } else {
        ogTitle = sessionName;
        ogDescription = "Clique e escolha suas fotos!";
      }
    }

    if (!ogImageUrl) {
      ogImageUrl = FALLBACK_OG_IMAGE;
    }

    const html = renderHtml({
      title: ogTitle,
      desc: ogDescription,
      brandName,
      ogImageUrl,
      canonicalUrl,
      imgWidth,
      imgHeight,
    });

    return new Response(html, {
      status: 200,
      headers: BOT_HTML_HEADERS,
    });
  } catch (err) {
    console.error("[gallery-og] error:", err);
    return new Response(renderHtml({
      title: "Fotografia",
      desc: "Clique e confira suas fotos!",
      brandName: "Fotografia",
      ogImageUrl: FALLBACK_OG_IMAGE,
      canonicalUrl,
    }), { status: 200, headers: BOT_HTML_HEADERS });
  }
});

