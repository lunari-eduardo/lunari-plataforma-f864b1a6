/**
 * Platform detection — Safari iOS/macOS aware.
 * Só apresentação/comportamento: nenhum acesso ao DB, sem regra de negócio.
 */

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const isIOS = /iP(hone|ad|od)/.test(ua);

export const isSafari =
  /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua) ||
  (isIOS && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua));

/** Safari iOS puro (não Chrome/Firefox/Edge em iOS). */
export const isIOSSafari =
  isIOS && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

/** True se rodando como PWA instalada (Add to Home Screen). */
export const isStandalone =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS legacy
    (navigator as any).standalone === true);

/** Feature detection — evita usar APIs indisponíveis em Safari antigo. */
export const supports = {
  broadcastChannel: typeof BroadcastChannel !== 'undefined',
  indexedDbDatabases:
    typeof indexedDB !== 'undefined' && 'databases' in indexedDB,
  visualViewport:
    typeof window !== 'undefined' && 'visualViewport' in window,
  dvh:
    typeof CSS !== 'undefined' && CSS.supports?.('height', '100dvh'),
};
