/**
 * Wrapper para imports dinâmicos com retry automático.
 * Se o chunk falhar (404 após deploy), recarrega a página 1x.
 */
const RELOAD_KEY = 'chunk-reload-ts';
const RELOAD_COOLDOWN_MS = 10_000; // evita loop: só recarrega 1x a cada 10s

export async function dynamicImport<T>(importFn: () => Promise<T>): Promise<T> {
  try {
    return await importFn();
  } catch (error: any) {
    const msg = error?.message || '';
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      error?.name === 'ChunkLoadError';

    if (isChunkError) {
      const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
      if (Date.now() - lastReload > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        // Nunca retorna, mas TS precisa
        return new Promise(() => {});
      }
    }

    throw error;
  }
}
