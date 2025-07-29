import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Teste temporário para verificar correção do cartão
import './utils/testCreditCardCalculation'

createRoot(document.getElementById("root")!).render(<App />);
