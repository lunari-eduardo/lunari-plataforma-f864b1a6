import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';
import { BOT_HTML_HEADERS, BOT_UA_RE, NO_STORE_HEADERS, renderHtml } from '../utils/html.js';

export async function galleryOgRoute(c: Context<{ Bindings: Bindings }>) {
  const url = new URL(c.req.url);
  const typeParam = (url.searchParams.get("type") || "").trim().toLowerCase();
  const token = (url.searchParams.get("token") || "").trim();
  const slug = (url.searchParams.get("slug") || "").trim();

  const PUBLIC_SITE_URL = c.env.VITE_SITE_URL;
  const R2_PUBLIC_URL = c.env.R2_CDN_BASE;
  const FALLBACK_OG_IMAGE = c.env.FALLBACK_OG_IMAGE;

  let targetPath = `/g/${token}`;
  if (typeParam === "deliver") targetPath = `/c/${token}`;
  else if (typeParam === "form") targetPath = `/formulario/${token}`;
  else if (typeParam === "proposal" && token) targetPath = `/p/${token}`;
  else if (typeParam === "proposal" && slug) targetPath = `/${slug}`;

  const canonicalUrl = `${PUBLIC_SITE_URL}${targetPath}`;

  // Se não for crawler (humanos), em tese eles nem batem aqui porque o Vercel faz o redirect no edge, 
  // mas caso caiam aqui por erro, não tem problema o fallback responder um HTML ou poderiamos dar redirect. 
  // No Vercel original: "has": [{"type": "header", "key": "user-agent", "value": "...BOT..."}]
  // Então só bots chegam aqui. Vamos assumir que são bots.

  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

    let ogTitle = "Fotografia";
    let ogDescription = "Clique e veja as informações.";
    let brandName = "Fotografia";
    let ogImageUrl: string | null = null;
    let imgWidth = 1200;
    let imgHeight = 630;

    if (typeParam === "form" && token) {
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
        const html = renderHtml({
          title: "Galeria não encontrada",
          desc: "Esta galeria de fotos não foi encontrada ou não está disponível.",
          brandName: "Fotografia",
          ogImageUrl: FALLBACK_OG_IMAGE,
          canonicalUrl,
        });
        return c.html(html, 404, NO_STORE_HEADERS);
      }

      const [{ data: settings }, { data: profile }] = await Promise.all([
        supabase.from("gallery_settings").select("studio_name, studio_logo_url").eq("user_id", gallery.user_id).maybeSingle(),
        supabase.from("profiles").select("nome, empresa, logo_url, avatar_url").eq("user_id", gallery.user_id).maybeSingle(),
      ]);

      const studioCandidate = (settings?.studio_name || "").trim();
      const companyCandidate = (profile?.empresa || "").trim();
      const nameCandidate = (profile?.nome || "").trim();

      if (studioCandidate && studioCandidate !== "Meu Estúdio") brandName = studioCandidate;
      else if (companyCandidate) brandName = companyCandidate;
      else if (nameCandidate) brandName = nameCandidate;

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

    if (!ogImageUrl) ogImageUrl = FALLBACK_OG_IMAGE;

    const html = renderHtml({
      title: ogTitle,
      desc: ogDescription,
      brandName,
      ogImageUrl,
      canonicalUrl,
      imgWidth,
      imgHeight,
      linkHref: canonicalUrl,
    });

    return c.html(html, 200, BOT_HTML_HEADERS);
  } catch (err) {
    console.error("[gallery-og] error:", err);
    const html = renderHtml({
      title: "Fotografia",
      desc: "Clique e confira suas fotos!",
      brandName: "Fotografia",
      ogImageUrl: FALLBACK_OG_IMAGE,
      canonicalUrl,
    });
    return c.html(html, 200, BOT_HTML_HEADERS);
  }
}
