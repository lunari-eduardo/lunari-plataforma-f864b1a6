import { Button } from '@/components/ui/button';
import { FileText, MessageCircle } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useLeads } from '@/hooks/useLeads';
import { useLeadInteractions } from '@/hooks/useLeadInteractions';
import type { Lead } from '@/types/leads';

interface LeadActionButtonsProps {
  lead: Lead;
}

export default function LeadActionButtons({ lead }: LeadActionButtonsProps) {
  const { updateLead } = useLeads();
  const { addInteraction } = useLeadInteractions();
  const { adicionarCliente } = useAppContext();

  const handleCreateBudget = () => {
    // Get or create client
    let clienteId = lead.clienteId;
    
    if (!clienteId) {
      // Create client from lead data
      const cliente = adicionarCliente({
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        whatsapp: lead.whatsapp,
        origem: lead.origem
      });
      clienteId = cliente.id;
      
      // Update lead with client id
      updateLead(lead.id, { clienteId });
    }

    // Navigate to budget creation with pre-filled client
    window.location.href = `/orcamentos?tab=novo&clienteId=${clienteId}&leadId=${lead.id}`;
  };

  const handleSendBudget = () => {
    // Create WhatsApp link with simple message
    const telefone = lead.whatsapp || lead.telefone;
    const cleanPhone = telefone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá ${lead.nome}! Espero que esteja bem. Gostaria de enviar uma proposta para você. Quando podemos conversar?`
    );
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${message}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank');
    
    // Move lead to "orcamento_enviado" and start follow-up
    updateLead(lead.id, {
      status: 'orcamento_enviado',
      needsFollowUp: false,
      statusTimestamp: new Date().toISOString()
    });
    
    // Add interaction
    addInteraction(
      lead.id,
      'followup',
      'Orçamento enviado via WhatsApp',
      true,
      'Lead movido para "Orçamento Enviado" - contador de follow-up iniciado'
    );
  };

  // Only show buttons when lead is in "aguardando" status
  if (lead.status !== 'aguardando') {
    return null;
  }

  return (
    <div className="flex gap-1 mt-2">
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs flex-1"
        onClick={handleCreateBudget}
      >
        <FileText className="h-3 w-3 mr-1" />
        Criar Orçamento
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs flex-1"
        onClick={handleSendBudget}
      >
        <MessageCircle className="h-3 w-3 mr-1" />
        Enviar Orçamento
      </Button>
    </div>
  );
}