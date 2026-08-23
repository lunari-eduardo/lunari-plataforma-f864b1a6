import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/egressLogger' // dev-only: loga respostas REST > 20KB
import './lib/workflowWaterfall' // dev-only: waterfall p/ investigação de cold-load do Workflow
import { bootstrapContext } from './shared/context/bootstrap' // Onda 4 — Context Engine v1

bootstrapContext();


// Auto-reload quando chunk fica obsoleto após deploy
const handleChunkError = (reason?: any) => {
  const msg = String(reason?.message || reason || '').toLowerCase();
  const isChunkError =
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('loading chunk');

  if (isChunkError) {
    const key = 'chunk-reload-ts';
    const last = Number(sessionStorage.getItem(key) || '0');
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  }
};

window.addEventListener('vite:preloadError', () => {
  handleChunkError('failed to fetch dynamically imported module');
});

window.addEventListener('unhandledrejection', (e) => {
  handleChunkError(e.reason);
});

// Handle legacy ?redirect= URLs from old 404.html before React mounts
const legacyRedirect = new URLSearchParams(window.location.search).get('redirect');
if (legacyRedirect) {
  window.history.replaceState({}, '', legacyRedirect);
}

// Limpar SW e caches em rotas públicas (galerias, propostas, formulário, checkout), preview ou iframe ANTES de montar React
const isPublicRoute = /^\/(g|c|p|formulario|checkout|pay|l)\//.test(window.location.pathname);
const isPreviewHost = window.location.hostname.includes('id-preview--');
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

if ((isPublicRoute || isPreviewHost || isInIframe) && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs =>
    regs.forEach(r => r.unregister())
  );
  caches.keys().then(names => names.forEach(n => caches.delete(n)));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
