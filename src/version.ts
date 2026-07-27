/**
 * Marcador de build. Em produção vira o SHA do commit da Vercel; em dev,
 * 'local-dev'. Serve para o watcher comparar contra `/version.json` remoto
 * e para instrumentação (diagnosticar defasagem repo↔deploy).
 */
export const BUILD_COMMIT: string =
  typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'local-dev';

export const BUILD_TIME: string =
  typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();

/** Alias legado — mantém `useVersionCheck` funcionando sem refatorar agora. */
export const BUILD_VERSION = BUILD_COMMIT;
