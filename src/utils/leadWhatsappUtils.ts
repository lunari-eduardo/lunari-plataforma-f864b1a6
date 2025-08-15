import { Lead } from '@/types/leads';
import { TemplateFile } from '@/types/templates';

export const gerarMensagemConversaSimples = (lead: Lead): string => {
  let mensagem = `Olá ${lead.nome}! 😊\n\n`;
  mensagem += `Vi que você demonstrou interesse em nossos serviços. `;
  
  if (lead.origem) {
    mensagem += `Encontrei você através de ${lead.origem}. `;
  }
  
  mensagem += `Como posso te ajudar?\n\n`;
  mensagem += `Ficarei feliz em esclarecer qualquer dúvida! 🤝`;
  
  return mensagem;
};

export const gerarMensagemComPDF = (lead: Lead, template: TemplateFile): string => {
  let mensagem = `Olá ${lead.nome}! 😊\n\n`;
  mensagem += `Preparei um material especial para você.\n\n`;
  mensagem += `📄 *Documento:* ${template.nome}\n`;
  mensagem += `📁 *Categoria:* ${getCategoriaLabel(template.categoria)}\n\n`;
  
  if (lead.observacoes) {
    mensagem += `*Baseado no seu interesse:*\n${lead.observacoes}\n\n`;
  }
  
  if (template.url && template.url.startsWith('data:')) {
    mensagem += `O documento está anexado a esta conversa.\n\n`;
  } else if (template.url) {
    mensagem += `🔗 *Link do documento:* ${template.url}\n\n`;
  }
  
  mensagem += `Caso tenha dúvidas, estarei à disposição! 🤝`;
  
  return mensagem;
};

export const abrirWhatsAppConversa = (lead: Lead): void => {
  const telefone = (lead.whatsapp || lead.telefone).replace(/\D/g, '');
  const mensagem = gerarMensagemConversaSimples(lead);
  const mensagemCodificada = encodeURIComponent(mensagem);
  
  const link = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
  window.open(link, '_blank');
};

export const abrirWhatsAppComPDF = (lead: Lead, template: TemplateFile): void => {
  const telefone = (lead.whatsapp || lead.telefone).replace(/\D/g, '');
  const mensagem = gerarMensagemComPDF(lead, template);
  const mensagemCodificada = encodeURIComponent(mensagem);
  
  const link = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
  window.open(link, '_blank');
};

const getCategoriaLabel = (categoria: TemplateFile['categoria']): string => {
  const labels = {
    'contrato': 'Contrato',
    'proposta': 'Proposta Comercial',
    'catalogo': 'Catálogo de Serviços',
    'outros': 'Documento'
  };
  return labels[categoria];
};

export const validarTelefoneWhatsApp = (telefone?: string, whatsapp?: string): boolean => {
  const numero = whatsapp || telefone;
  if (!numero) return false;
  
  const numeroLimpo = numero.replace(/\D/g, '');
  return numeroLimpo.length >= 10 && numeroLimpo.length <= 11;
};