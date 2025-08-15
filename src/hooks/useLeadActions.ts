import { useState } from 'react';
import { useLeads } from './useLeads';
import { Lead } from '@/types/leads';
import { TemplateFile } from '@/types/templates';
import { abrirWhatsAppConversa, abrirWhatsAppComPDF } from '@/utils/leadWhatsappUtils';
import { toast } from 'sonner';

interface LeadAction {
  tipo: 'whatsapp_simples' | 'pdf_enviado' | 'status_alterado';
  data: string;
  dadosExtras?: {
    pdfEnviado?: string;
    statusAnterior?: string;
    statusNovo?: string;
  };
}

export function useLeadActions() {
  const [loading, setLoading] = useState(false);
  const { updateLead } = useLeads();

  const executarAcaoComStatus = async (
    lead: Lead,
    acao: LeadAction,
    novoStatus: string
  ) => {
    try {
      setLoading(true);
      
      // Atualizar lead com nova ação e status
      await updateLead(lead.id, {
        status: novoStatus,
        ultimaAcao: acao
      });

      // Feedback visual
      const statusLabels = {
        'em_contato': 'Em Contato',
        'proposta_enviada': 'Proposta Enviada',
        'convertido': 'Convertido',
        'perdido': 'Perdido'
      };
      
      const statusLabel = statusLabels[novoStatus as keyof typeof statusLabels] || novoStatus;
      toast.success(`Lead movido para "${statusLabel}"`);
      
    } catch (error) {
      console.error('Erro ao executar ação:', error);
      toast.error('Erro ao executar ação');
    } finally {
      setLoading(false);
    }
  };

  const iniciarConversaWhatsApp = async (lead: Lead) => {
    try {
      setLoading(true);
      
      // Abrir WhatsApp
      abrirWhatsAppConversa(lead);
      
      // Registrar ação e mover status
      const acao: LeadAction = {
        tipo: 'whatsapp_simples',
        data: new Date().toISOString(),
        dadosExtras: {
          statusAnterior: lead.status,
          statusNovo: 'em_contato'
        }
      };
      
      await executarAcaoComStatus(lead, acao, 'em_contato');
      
    } catch (error) {
      console.error('Erro ao iniciar conversa:', error);
      toast.error('Erro ao abrir WhatsApp');
      setLoading(false);
    }
  };

  const enviarPDFPorWhatsApp = async (lead: Lead, template: TemplateFile) => {
    try {
      setLoading(true);
      
      // Abrir WhatsApp com PDF
      abrirWhatsAppComPDF(lead, template);
      
      // Registrar ação e mover status
      const acao: LeadAction = {
        tipo: 'pdf_enviado',
        data: new Date().toISOString(),
        dadosExtras: {
          pdfEnviado: template.nome,
          statusAnterior: lead.status,
          statusNovo: 'proposta_enviada'
        }
      };
      
      await executarAcaoComStatus(lead, acao, 'proposta_enviada');
      
    } catch (error) {
      console.error('Erro ao enviar PDF:', error);
      toast.error('Erro ao enviar PDF via WhatsApp');
      setLoading(false);
    }
  };

  const moverParaStatus = async (lead: Lead, novoStatus: string) => {
    try {
      setLoading(true);
      
      const acao: LeadAction = {
        tipo: 'status_alterado',
        data: new Date().toISOString(),
        dadosExtras: {
          statusAnterior: lead.status,
          statusNovo: novoStatus
        }
      };
      
      await executarAcaoComStatus(lead, acao, novoStatus);
      
    } catch (error) {
      console.error('Erro ao mover status:', error);
      toast.error('Erro ao alterar status');
      setLoading(false);
    }
  };

  return {
    loading,
    iniciarConversaWhatsApp,
    enviarPDFPorWhatsApp,
    moverParaStatus
  };
}