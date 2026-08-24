import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { trackShareEventRoute } from './routes/track-share-event.js';
import { gestaoR2PublicUploadRoute } from './routes/gestao-r2-public-upload.js';
import { gestaoR2UploadRoute } from './routes/gestao-r2-upload.js';
import { gestaoR2SignedUrlRoute } from './routes/gestao-r2-signed-url.js';
import { gestaoR2DeleteRoute } from './routes/gestao-r2-delete.js';
import { mediaDownloadRoute } from './routes/media-download.js';

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VITE_SITE_URL: string;
  R2_CDN_BASE: string;
  R2_COMMERCIAL_CDN_BASE: string;
  ANALYTICS_SALT: string;

  // R2 Bucket Bindings
  LUNARI_PREVIEWS: R2Bucket;
  LUNARI_PRIVATE: R2Bucket;
  LUNARI_COMMERCIAL_DOCUMENTS: R2Bucket;
  LUNARI_MEDIA: R2Bucket;
  LUNARI_GALLERY: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

app.get('/', (c) => c.text('Lunari Edge API (Analytics & R2 Storage) is running!'));

// Rota de download protegido
app.get('/api/media/download', mediaDownloadRoute);

// Rotas mapeadas de acordo com as antigas funções do Supabase
app.post('/functions/v1/track-share-event', trackShareEventRoute);
app.post('/functions/v1/gestao-r2-public-upload', gestaoR2PublicUploadRoute);
app.post('/functions/v1/gestao-r2-upload', gestaoR2UploadRoute);
app.post('/functions/v1/gestao-r2-signed-url', gestaoR2SignedUrlRoute);
app.post('/functions/v1/gestao-r2-delete', gestaoR2DeleteRoute);

// Atalhos limpos de API
app.post('/api/track-share-event', trackShareEventRoute);
app.post('/api/r2-public-upload', gestaoR2PublicUploadRoute);
app.post('/api/r2-upload', gestaoR2UploadRoute);
app.post('/api/r2-signed-url', gestaoR2SignedUrlRoute);
app.post('/api/r2-delete', gestaoR2DeleteRoute);

export default app;
