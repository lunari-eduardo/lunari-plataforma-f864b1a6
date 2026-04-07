import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Auto-reload quando chunk fica obsoleto após deploy
window.addEventListener('vite:preloadError', () => {
  const key = 'chunk-reload-ts';
  const last = Number(sessionStorage.getItem(key) || '0');
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

// Limpar SW e caches em rotas públicas, preview ou iframe ANTES de montar React
const isPublicRoute = /^\/(formulario|checkout)\//.test(window.location.pathname);
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
