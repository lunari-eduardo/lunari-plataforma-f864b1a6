import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageCircle, Eye, Trash2, FileText, Calendar, CheckCircle, ExternalLink, Link2 } from 'lucide-react';
import type { Lead } from '@/types/leads';
import { useAppContext } from '@/contexts/AppContext';
import { linkLeadToClient, getAvailableClientsForLinking } from '@/utils/leadClientSync';
import { toast } from 'sonner';

interface LeadActionsPopoverProps {
  lead: Lead;
  onStartConversation: () => void;
  onShowDetails: () => void;
  onConvert?: () => void;
  onDelete: () => void;
  onScheduleClient?: () => void;
  onMarkAsScheduled?: () => void;
  onViewAppointment?: () => void;
  children: React.ReactNode;
}

export default function LeadActionsPopover({
  lead,
  onStartConversation,
  onShowDetails,
  onConvert,
  onDelete,
  onScheduleClient,
  onMarkAsScheduled,
  onViewAppointment,
  children
}: LeadActionsPopoverProps) {
  const [open, setOpen] = useState(false);
  const { clientes } = useAppContext();

  // Check client linking status
  const clientLinkInfo = useMemo(() => {
    if (!lead.clienteId) return { hasClient: false };
    
    const client = clientes.find(c => c.id === lead.clienteId);
    if (!client) return { hasClient: false };
    
    return { hasClient: true, client };
  }, [lead, clientes]);

  const availableClients = useMemo(() => {
    return getAvailableClientsForLinking(lead.id);
  }, [lead.id]);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };


  const handleLinkToClient = (clienteId: string) => {
    if (linkLeadToClient(lead.id, clienteId)) {
      toast.success('Lead vinculado ao cliente CRM');
    } else {
      toast.error('Erro ao vincular lead');
    }
    setOpen(false);
  };

  const isConverted = lead.status === 'convertido';
  const isLost = lead.status === 'perdido';
  const hasScheduledAppointment = !!lead.scheduledAppointmentId;
  const needsScheduling = lead.needsScheduling;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={() => handleAction(onShowDetails)}
          >
            <Eye className="h-4 w-4" />
            Ver Detalhes
          </Button>

          {/* Options for converted leads */}
          {isConverted ? (
            <>
              {!hasScheduledAppointment && onScheduleClient && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-8"
                  onClick={() => handleAction(onScheduleClient)}
                >
                  <Calendar className="h-4 w-4" />
                  Agendar Cliente
                </Button>
              )}

              {needsScheduling && onMarkAsScheduled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-8"
                  onClick={() => handleAction(onMarkAsScheduled)}
                >
                  <CheckCircle className="h-4 w-4" />
                  Marcar como Agendado
                </Button>
              )}

              {hasScheduledAppointment && onViewAppointment && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-8"
                  onClick={() => handleAction(onViewAppointment)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver Agendamento
                </Button>
              )}
            </>
          ) : (
            <>
              {/* Options for non-converted leads */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-8"
                onClick={() => handleAction(onStartConversation)}
              >
                <MessageCircle className="h-4 w-4" />
                Iniciar Conversa
              </Button>

              {!isLost && onConvert && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-8"
                  onClick={() => handleAction(onConvert)}
                >
                  <FileText className="h-4 w-4" />
                  Converter
                </Button>
              )}
            </>
          )}

          {!clientLinkInfo.hasClient && availableClients.length > 0 && (
            <div className="border-t pt-1 mt-1">
              <div className="text-xs text-muted-foreground px-2 py-1">Vincular a Cliente:</div>
              {availableClients.slice(0, 3).map(cliente => (
                <Button
                  key={cliente.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-8 text-xs"
                  onClick={() => handleLinkToClient(cliente.id)}
                >
                  <Link2 className="h-3 w-3" />
                  {cliente.nome}
                </Button>
              ))}
              {availableClients.length > 3 && (
                <div className="text-xs text-muted-foreground px-2 py-1">
                  +{availableClients.length - 3} outros...
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-1 mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-lunar-error hover:text-lunar-error"
              onClick={() => handleAction(onDelete)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}