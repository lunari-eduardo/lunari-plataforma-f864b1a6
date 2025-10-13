import { Button } from "@/components/ui/button";
import { FileText, MessageCircle } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { useLeads } from "@/hooks/useLeads";
import { useLeadInteractions } from "@/hooks/useLeadInteractions";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import type { Lead } from "@/types/leads";

interface LeadActionButtonsProps {
  lead: Lead;
}

export default function LeadActionButtons({ lead }: LeadActionButtonsProps) {
  const { updateLead } = useLeads();
  const { addInteraction } = useLeadInteractions();
  const { adicionarCliente } = useAppContext();
  const { adicionarOrcamento } = useOrcamentos();

  const handleCreateBudget = () => {
    // Simply open WhatsApp to send budget
    handleSendBudget();
  };

  const handleSendBudget = () => {
    // Get or create client
    let clienteId = lead.clienteId;

    if (!clienteId) {
      // Create client from lead data
      const cliente = adicionarCliente({
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        whatsapp: lead.whatsapp,
        origem: lead.origem,
      });
      clienteId = cliente.id;

      // Update lead with client id
      updateLead(lead.id, { clienteId });
    }

    // Create WhatsApp link with simple message
    const telefone = lead.whatsapp || lead.telefone;
    const cleanPhone = telefone.replace(/\D/g, "");
    const message = encodeURIComponent(`Olá ${lead.nome}! Tudo bem?`);
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${message}`;

    // Open WhatsApp
    window.open(whatsappUrl, "_blank");

    // Move lead to "negociacao" status
    updateLead(lead.id, {
      status: "negociacao",
      statusTimestamp: new Date().toISOString(),
    });

    // Add interaction
    addInteraction(
      lead.id,
      "followup",
      "Orçamento enviado via WhatsApp",
      true,
      'Lead movido para "Em Negociação" após envio do orçamento',
    );
  };

  // Only show buttons when lead is in "aguardando" status
  if (lead.status !== "aguardando") {
    return null;
  }

  return (
    <div className="flex gap-1 mt-2">
      {/* Temporariamente desabilitado - Orçamentos */}
      {/* <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={handleSendBudget}
      >
        <MessageCircle className="h-3 w-3 mr-1" />
        Enviar Orçamento
      </Button> */}
    </div>
  );
}
