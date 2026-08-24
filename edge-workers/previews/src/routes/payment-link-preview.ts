import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';
import { BOT_HTML_HEADERS, BOT_UA_RE, NO_STORE_HEADERS, renderHtml, BrandedPreviewCtx } from '../utils/html.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HUMAN_HTML_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function firstName(fullName?: string | null): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  if (parts.length === 0 || !parts[0]) return "";
  const f = parts[0];
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}

export async function paymentLinkPreviewRoute(c: Context<{ Bindings: Bindings }>) {
  const url = new URL(c.req.url);
  const id = (url.searchParams.get("id") || "").trim().toLowerCase();
  
  const PUBLIC_SITE_URL = c.env.VITE_SITE_URL;
  const FALLBACK_OG_IMAGE = c.env.FALLBACK_OG_IMAGE;
  const canonicalUrl = `${PUBLIC_SITE_URL}/l/${id}`;
  
  const userAgent = c.req.header("user-agent") || "";
  const accept = c.req.header("accept") || "";
  const isBot = BOT_UA_RE.test(userAgent);
  const wantsHtml = accept.includes("text/html") || accept.includes("*/*") || accept === "";
  const treatAsBot = isBot || !wantsHtml;

  function renderInvalid(canonicalUrl: string, brandName = "Fotografia") {
    const html = renderHtml({
      title: "Link de pagamento não disponível",
      desc: "Este link de pagamento não foi encontrado ou já não está mais ativo.",
      brandName,
      ogImageUrl: FALLBACK_OG_IMAGE,
      canonicalUrl,
      bodyMessage: "Link de pagamento não disponível",
    });
    return c.html(html, 404, { ...HUMAN_HTML_HEADERS, "Content-Type": "text/html; charset=utf-8" });
  }

  if (!id || !UUID_RE.test(id)) {
    return renderInvalid(canonicalUrl);
  }

  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: cobranca, error: cErr } = await supabase
      .from("cobrancas")
      .select("id, valor, descricao, status, provedor, user_id, cliente_id, galeria_id")
      .eq("id", id)
      .maybeSingle();

    if (cErr || !cobranca) {
      console.warn("[payment-link-preview] cobranca não encontrada", { id, cErr });
      return renderInvalid(canonicalUrl);
    }

    let galleryToken: string | null = null;
    if (cobranca.galeria_id) {
      const { data: gal } = await supabase
        .from("galerias")
        .select("public_token")
        .eq("id", cobranca.galeria_id)
        .maybeSingle();
      galleryToken = gal?.public_token || null;
    }

    const targetPath = `/checkout/${cobranca.id}`;
    const absoluteTarget = `${PUBLIC_SITE_URL}${targetPath}`;
    const status = cobranca.status;
    const isFinalState = status === "pago" || status === "cancelado" || status === "expirado";

    if (!treatAsBot) {
      if (status === "pago" && galleryToken) {
        return c.redirect(`${PUBLIC_SITE_URL}/g/${galleryToken}?payment=success`, 302);
      }
      return c.redirect(absoluteTarget, 302);
    }

    const [{ data: profile }, { data: settings }, { data: cliente }] = await Promise.all([
      supabase.from("profiles").select("nome, empresa, logo_url, avatar_url").eq("user_id", cobranca.user_id).maybeSingle(),
      supabase.from("gallery_settings").select("studio_name, studio_logo_url, theme_overrides").eq("user_id", cobranca.user_id).maybeSingle(),
      cobranca.cliente_id
        ? supabase.from("clientes").select("nome").eq("id", cobranca.cliente_id).maybeSingle()
        : Promise.resolve({ data: null as { nome: string | null } | null }),
    ]);

    const studioCandidate = (settings?.studio_name || "").trim();
    const companyCandidate = (profile?.empresa || "").trim();
    const nameCandidate = (profile?.nome || "").trim();

    let brandName = "Fotografia";
    if (studioCandidate && studioCandidate !== "Meu Estúdio") brandName = studioCandidate;
    else if (companyCandidate) brandName = companyCandidate;
    else if (nameCandidate) brandName = nameCandidate;

    const themeOverrides = (settings?.theme_overrides as Record<string, any>) || {};
    const billingLogo = (themeOverrides.billing_logo_url || themeOverrides.billingLogoUrl || "").toString().trim();
    const candidateLogo = (billingLogo || settings?.studio_logo_url || profile?.logo_url || profile?.avatar_url || "").trim();
    const ogImageUrl = (candidateLogo.startsWith("http://") || candidateLogo.startsWith("https://"))
      ? candidateLogo
      : FALLBACK_OG_IMAGE;

    const valorFmt = formatBRL(Number(cobranca.valor || 0));
    const primeiroNome = firstName(cliente?.nome);
    const descRaw = (cobranca.descricao || "").toString().trim();

    let title: string;
    let desc: string;
    let bodyMessage: string;
    let linkHref: string | undefined;

    if (status === "pago") {
      title = `Pagamento concluído — ${brandName}`;
      desc = `Cobrança de ${valorFmt} paga com sucesso.`;
      bodyMessage = "Pagamento concluído";
      linkHref = galleryToken ? `${PUBLIC_SITE_URL}/g/${galleryToken}` : absoluteTarget;
    } else if (status === "cancelado" || status === "expirado") {
      title = `Link não disponível — ${brandName}`;
      desc = "Este link de pagamento não está mais ativo.";
      bodyMessage = "Link de pagamento não disponível";
    } else {
      const saudacao = primeiroNome ? `Olá, ${primeiroNome}! ` : "";
      const descSuffix = descRaw ? ` — ${descRaw.substring(0, 90)}` : "";
      title = `Pagamento para ${brandName} — ${valorFmt}`;
      desc = `${saudacao}Sua cobrança de ${valorFmt}${descSuffix}.`;
      bodyMessage = `Pagamento de ${valorFmt}`;
      linkHref = absoluteTarget;
    }

    const html = renderHtml({
      title,
      desc,
      brandName,
      ogImageUrl,
      canonicalUrl,
      bodyMessage,
      linkHref,
    });

    const headers = isFinalState ? HUMAN_HTML_HEADERS : BOT_HTML_HEADERS;
    return c.html(html, 200, headers);
  } catch (err) {
    console.error("[payment-link-preview] erro", err);
    return renderInvalid(canonicalUrl);
  }
}
