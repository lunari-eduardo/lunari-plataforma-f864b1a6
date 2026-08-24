import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { sitemapRoute } from './routes/sitemap.js';
import { galleryOgRoute } from './routes/gallery-og.js';
import { paymentLinkPreviewRoute } from './routes/payment-link-preview.js';
import { publicLinkPreviewRoute } from './routes/public-link-preview.js';
import { getPublicThemeRoute } from './routes/get-public-theme.js';

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VITE_SITE_URL: string;
  R2_CDN_BASE: string;
  FALLBACK_OG_IMAGE: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

app.get('/', (c) => c.text('Lunari Edge Previews (Cloudflare Workers) is running!'));

// Rotas mapeadas de acordo com as antigas funções do Supabase
app.get('/functions/v1/sitemap', sitemapRoute);
app.get('/functions/v1/gallery-og', galleryOgRoute);
app.get('/functions/v1/payment-link-preview', paymentLinkPreviewRoute);
app.get('/functions/v1/public-link-preview', publicLinkPreviewRoute);
app.post('/functions/v1/get-public-theme', getPublicThemeRoute);

// Atalho limpo (opcional, para futuras refatorações do Vercel)
app.get('/api/sitemap', sitemapRoute);
app.get('/api/gallery-og', galleryOgRoute);
app.get('/api/payment-link-preview', paymentLinkPreviewRoute);
app.get('/api/public-link-preview', publicLinkPreviewRoute);
app.post('/api/get-public-theme', getPublicThemeRoute);

export default app;
