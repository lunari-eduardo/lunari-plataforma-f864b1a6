import type { Lead } from '@/types/leads';

export const gerarMensagemConversa = (lead: Lead): string => {
  return `Olá ${lead.nome}! 😊\n\nVi que você demonstrou interesse em nossos serviços. Como posso ajudá-lo(a)?`;
};

export const gerarMensagemOrcamento = (lead: Lead, nomeArquivo: string, mensagemPersonalizada?: string): string => {
  const mensagemPadrao = `Olá ${lead.nome}! 😊\n\nSegue seu orçamento personalizado em anexo.\n\n`;
  const mensagemFinal = mensagemPersonalizada || 'Caso tenha dúvidas, estarei à disposição! 🤝';
  
  return `${mensagemPadrao}📄 *Arquivo:* ${nomeArquivo}\n\n${mensagemFinal}`;
};

export const abrirWhatsAppConversa = (lead: Lead) => {
  const telefone = lead.telefone.replace(/\D/g, '');
  const mensagem = gerarMensagemConversa(lead);
  const mensagemCodificada = encodeURIComponent(mensagem);
  const link = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
  window.open(link, '_blank');
};

export const abrirWhatsAppComPDF = (lead: Lead, nomeArquivo: string, mensagemPersonalizada?: string) => {
  const telefone = lead.telefone.replace(/\D/g, '');
  const mensagem = gerarMensagemOrcamento(lead, nomeArquivo, mensagemPersonalizada);
  const mensagemCodificada = encodeURIComponent(mensagem);
  const link = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
  window.open(link, '_blank');
};