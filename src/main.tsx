import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeAppWithFix } from './utils/initializeAppFixed'

// Inicializar com correção automática
initializeAppWithFix();

createRoot(document.getElementById("root")!).render(<App />);
