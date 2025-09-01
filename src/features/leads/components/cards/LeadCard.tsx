import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, Calendar, MessageCircle, Phone, Mail, Clock, ExternalLink } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';
import type { Lead } from '@/types/leads';
import LeadActionsPopover from '../ui/LeadActionsPopover';
import { cn } from '@/lib/utils';

interface LeadCardProps {
  lead: Lead;
  onDelete: () => void;
  onConvertToClient: () => void;
  onRequestMove?: (status: string) => void;
  statusOptions: { value: string; label: string }[];
  onScheduleClient?: () => void;
  onMarkAsScheduled?: () => void;
  onViewAppointment?: () => void;
  onDirectScheduling?: () => void;
  
  // DnD props (opcional para componente não-draggable)
  dndRef?: any;
  dndListeners?: any;
  dndAttributes?: any;
  dndStyle?: React.CSSProperties;
  isDragging?: boolean;
}

export default function LeadCard({
  lead,
  onDelete,
  onConvertToClient,
  onRequestMove,
  statusOptions,
  onScheduleClient,
  onMarkAsScheduled,
  onViewAppointment,
  onDirectScheduling,
  dndRef,
  dndListeners,
  dndAttributes,
  dndStyle,
  isDragging
}: LeadCardProps) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNowStrict(new Date(lead.dataCriacao), { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return 'Data inválida';
    }
  }, [lead.dataCriacao]);

  const handleWhatsAppClick = () => {
    const telefone = lead.whatsapp || lead.telefone;
    const cleanPhone = telefone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${lead.nome}! Tudo bem?`);
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleStartConversation = () => {
    handleWhatsAppClick();
  };

  const handleShowDetails = () => {
    // This will be handled by the parent component
  };

  const isConverted = lead.status === 'convertido';
  const isLost = lead.status === 'perdido';
  const hasScheduledAppointment = !!lead.scheduledAppointmentId;
  const needsScheduling = lead.needsScheduling;

  return (
    <Card 
      ref={dndRef}
      style={dndStyle}
      className={cn(
        "group relative p-3 hover:shadow-lg transition-all duration-300 border-lunar-border/60 bg-lunar-surface/80 backdrop-blur-sm hover:border-lunar-accent/30",
        isDragging && "opacity-50 rotate-2 scale-105 shadow-2xl border-lunar-accent"
      )}
      {...dndAttributes}
    >
      <CardContent className="p-0 space-y-3">
        {/* Header with name and actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-lunar-accent/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-lunar-accent">
                  {lead.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm text-lunar-text truncate">
                  {lead.nome}
                </h3>
                {lead.origem && (
                  <Badge variant="secondary" className="text-xs mt-1">
                    {lead.origem}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <LeadActionsPopover
            lead={lead}
            onStartConversation={handleStartConversation}
            onShowDetails={handleShowDetails}
            onConvert={onConvertToClient}
            onDelete={onDelete}
            onScheduleClient={onScheduleClient}
            onMarkAsScheduled={onMarkAsScheduled}
            onViewAppointment={onViewAppointment}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              {...dndListeners}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </LeadActionsPopover>
        </div>

        {/* Contact info */}
        <div className="space-y-1 text-xs text-lunar-textSecondary">
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.telefone}</span>
          </div>
        </div>

        {/* Time info and status indicators */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-lunar-textSecondary">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}</span>
          </div>
          
          <div className="flex gap-1">
            {lead.needsFollowUp && (
              <Badge variant="destructive" className="text-2xs px-1 py-0">
                Follow-up
              </Badge>
            )}
            {hasScheduledAppointment && (
              <Badge variant="default" className="text-2xs px-1 py-0">
                <Calendar className="h-2 w-2 mr-1" />
                Agendado
              </Badge>
            )}
            {needsScheduling && !hasScheduledAppointment && (
              <Badge variant="secondary" className="text-2xs px-1 py-0">
                <Calendar className="h-2 w-2 mr-1" />
                Agendar
              </Badge>
            )}
          </div>
        </div>

        {/* Observações */}
        {lead.observacoes && (
          <div className="text-xs text-lunar-textSecondary bg-lunar-bg/50 p-2 rounded-md">
            <p className="line-clamp-2">{lead.observacoes}</p>
          </div>
        )}

        {/* Actions for converted leads */}
        {isConverted && (
          <div className="flex gap-1 pt-2 border-t border-lunar-border/40">
            {!hasScheduledAppointment && onScheduleClient && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-1" onClick={onScheduleClient}>
                <Calendar className="h-3 w-3 mr-1" />
                Agendar
              </Button>
            )}
            
            {needsScheduling && onMarkAsScheduled && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-1" onClick={onMarkAsScheduled}>
                ✓ Agendado
              </Button>
            )}
            
            {hasScheduledAppointment && onViewAppointment && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-1" onClick={onViewAppointment}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Ver
              </Button>
            )}
          </div>
        )}

        {/* Quick contact actions for non-converted leads */}
        {!isConverted && !isLost && (
          <div className="flex gap-1 pt-2 border-t border-lunar-border/40">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs flex-1"
              onClick={handleWhatsAppClick}
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              WhatsApp
            </Button>
            
            {onDirectScheduling && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={onDirectScheduling}
              >
                <Calendar className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}