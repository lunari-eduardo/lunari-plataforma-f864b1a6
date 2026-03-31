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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
