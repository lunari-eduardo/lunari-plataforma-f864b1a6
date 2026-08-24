import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';
import { BOT_HTML_HEADERS, BOT_UA_RE, NO_STORE_HEADERS, renderHtml } from '../utils/html.js';

export async function publicLinkPreviewRoute(c: Context<{ Bindings: Bindings }>) {
  const url = new URL(c.req.url);
  const type = (url.searchParams.get("type") || "").trim().toLowerCase();
  const token = (url.searchParams.get("token") || "").trim();
  const slug = (url.searchParams.get("slug") || "").trim();

  const PUBLIC_SITE_URL = c.env.VITE_SITE_URL;
  const FALLBACK_OG_IMAGE = c.env.FALLBACK_OG_IMAGE;

  let targetPath = "/";
  if (type === "form") targetPath = `/formulario/${token}`;
  else if (type === "proposal" && token) targetPath = `/p/${token}`;
  else if (type === "proposal" && slug) targetPath = `/${slug}`;

  const canonicalUrl = `${PUBLIC_SITE_URL}${targetPath}`;
  const userAgent = c.req.header("user-agent") || "";
  const accept = c.req.header("accept") || "";
  const isBot = BOT_UA_RE.test(userAgent);
  const wantsHtml = accept.includes("text/html") || accept.includes("*/*") || accept === "";
  const treatAsBot = isBot || !wantsHtml;

  // Se for humano, redireciona para a SPA
  if (!treatAsBot) {
    return c.redirect(canonicalUrl, 302);
  }

  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

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

    return c.html(html, 200, BOT_HTML_HEADERS);
  } catch (err) {
    console.error("[public-link-preview] error:", err);
    return c.html(renderHtml({
      title: "Fotografia",
      desc: "Acesse o link para conferir as informações.",
      brandName: "Fotografia",
      ogImageUrl: FALLBACK_OG_IMAGE,
      canonicalUrl,
    }), 200, BOT_HTML_HEADERS);
  }
}
