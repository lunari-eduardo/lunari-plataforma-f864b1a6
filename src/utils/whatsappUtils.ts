
// import { Orcamento } from '@/types/orcamentos'; // Removed - budgets decoupled
import { formatDateForDisplay } from './dateUtils';

export const gerarLinkWhatsApp = (orcamento: any, pdfUrl?: string): string => {
  // DISABLED: Budget functionality removed
  return `https://wa.me/5511999999999?text=Funcionalidade removida - orçamentos desacoplados`;
};

export const abrirWhatsApp = (orcamento: any, pdfUrl?: string) => {
  // DISABLED: Budget functionality removed
  console.log('WhatsApp integration disabled - budgets decoupled');
};
