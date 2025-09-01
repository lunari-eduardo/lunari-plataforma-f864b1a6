import { toast } from 'sonner';
import type { Lead } from '@/types/leads';
import { useLeadInteractions } from '@/hooks/useLeadInteractions';

export function useLeadCardActions() {
  const { addInteraction } = useLeadInteractions();

  const startConversation = (lead: Lead, onRequestMove?: (status: string) => void) => {
    try {
      const telefone = lead.telefone.replace(/\D/g, '');
      const mensagem = `Olá ${lead.nome}! 😊\n\nVi que você demonstrou interesse em nossos serviços. Como posso ajudá-lo(a)?`;
      const mensagemCodificada = encodeURIComponent(mensagem);
      const link = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
      window.open(link, '_blank');
      toast.success('WhatsApp aberto para conversa');
      
      // Registrar interação de conversa
      addInteraction(lead.id, 'conversa', 'Conversa iniciada via WhatsApp', false);
      
      // Move para "aguardando" se ainda estiver em "novo_interessado"
      if (lead.status === 'novo_interessado') {
        onRequestMove?.('aguardando');
      }
    } catch (error) {
      toast.error('Erro ao abrir WhatsApp');
    }
  };

  const requestMove = (lead: Lead, status: string, onRequestMove?: (status: string) => void) => {
    onRequestMove?.(status);
    toast.success('Status alterado');
  };

  return {
    startConversation,
    requestMove
  };
}