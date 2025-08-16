
import { Orcamento } from '@/types/orcamentos';
import { formatDateForDisplay } from './dateUtils';

export const gerarLinkWhatsApp = (orcamento: Orcamento, pdfUrl?: string): string => {
  const valorFinal = orcamento.valorFinal || orcamento.valorTotal;
  const telefone = orcamento.cliente.telefone.replace(/\D/g, '');
  
  let mensagem = `Olá ${orcamento.cliente.nome}! 😊\n\n`;
  mensagem += `Aqui está seu orçamento para ${orcamento.categoria}:\n\n`;
  mensagem += `📅 *Data:* ${formatDateForDisplay(orcamento.data)}\n`;
  mensagem += `⏰ *Horário:* ${orcamento.hora}\n\n`;
  mensagem += `💰 *Valor:* R$ ${valorFinal.toFixed(2)}\n\n`;
  
  if (orcamento.detalhes) {
    mensagem += `📋 *Detalhes:*\n${orcamento.detalhes}\n\n`;
  }
  
  if (pdfUrl) {
    mensagem += `📄 *PDF completo:* ${pdfUrl}\n\n`;
  }
  
  mensagem += `Caso tenha dúvidas, estarei à disposição! 🤝`;
  
  const mensagemCodificada = encodeURIComponent(mensagem);
  return `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
};

export const abrirWhatsApp = (orcamento: Orcamento, pdfUrl?: string) => {
  const link = gerarLinkWhatsApp(orcamento, pdfUrl);
  window.open(link, '_blank');
};
