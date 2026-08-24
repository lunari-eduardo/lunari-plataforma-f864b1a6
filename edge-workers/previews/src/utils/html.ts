export const BOT_UA_RE = /(whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|telegrambot|discordbot|skypeuripreview|googlebot|google-inspectiontool|bingbot|yandexbot|duckduckbot|preview|embedly|redditbot|pinterest|applebot|iframely|vkshare|snapchat|line-poker|nuzzel|qwantify|baiduspider|msnbot|mediapartners-google|whatsapp-preview|w3c_validator|opengraph|metatags)/i;

export const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

export const BOT_HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function escapeHtml(v: string): string {
  if (!v) return "";
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncate(v: string, max: number): string {
  const s = v.trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export interface BrandedPreviewCtx {
  title: string;
  desc: string;
  brandName: string;
  ogImageUrl: string;
  canonicalUrl: string;
  imgWidth?: number;
  imgHeight?: number;
  bodyMessage?: string;
  linkHref?: string;
}

export function renderHtml(c: BrandedPreviewCtx): string {
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
  <h1>${escapeHtml(c.bodyMessage || c.title)}</h1>
  <p>${escapeHtml(c.desc)}</p>
  ${c.linkHref ? `<a class="btn" href="${escapeHtml(c.linkHref)}">Acessar</a>` : ''}
</div></div>
</body>
</html>`;
}
