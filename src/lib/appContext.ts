/**
 * App context detection by hostname.
 *
 * - admin.lunarihub.com         → 'admin'
 * - gallery.lunarihub.com       → 'gallery' (reservado — sem mudança nesta fase)
 * - app.lunarihub.com (default) → 'photographer'
 *
 * Override via querystring (?context=admin) para validar em preview / localhost.
 */
export type AppContext = 'photographer' | 'admin' | 'gallery';

export const ADMIN_HOST = 'admin.lunarihub.com';
export const ADMIN_URL = `https://${ADMIN_HOST}`;
export const APP_HOST = 'app.lunarihub.com';
export const APP_URL = `https://${APP_HOST}`;

export function detectAppContext(): AppContext {
  if (typeof window === 'undefined') return 'photographer';

  // Override explícito via querystring — útil para previews Lovable e dev
  try {
    const override = new URLSearchParams(window.location.search).get('context');
    if (override === 'admin' || override === 'photographer' || override === 'gallery') {
      // Persistir em sessionStorage para sobreviver navegação SPA
      sessionStorage.setItem('__lunari_context_override', override);
      return override;
    }
    const stored = sessionStorage.getItem('__lunari_context_override');
    if (stored === 'admin' || stored === 'photographer' || stored === 'gallery') {
      return stored as AppContext;
    }
  } catch {
    // sessionStorage indisponível — segue para detecção por host
  }

  const host = window.location.hostname.toLowerCase();
  if (host === ADMIN_HOST || host.startsWith('admin.')) return 'admin';
  if (host === 'gallery.lunarihub.com' || host.startsWith('gallery.')) return 'gallery';
  return 'photographer';
}

export const isAdminContext = () => detectAppContext() === 'admin';
