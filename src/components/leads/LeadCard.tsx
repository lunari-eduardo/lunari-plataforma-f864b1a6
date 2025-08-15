import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical, MessageCircle } from 'lucide-react';
import type { Lead } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import LeadActionsPopover from './LeadActionsPopover';
import LeadStatusSelector from './LeadStatusSelector';
import LeadDetailsModal from './LeadDetailsModal';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { toast } from 'sonner';

interface LeadCardProps {
  lead: Lead;
  onDelete: () => void;
  onConvertToOrcamento: () => void;
  onRequestMove?: (status: string) => void;
  statusOptions: {
    value: string;
    label: string;
  }[];
  dndRef?: (node: HTMLElement | null) => void;
  dndListeners?: any;
  dndAttributes?: any;
  dndStyle?: any;
  isDragging?: boolean;
}

export default function LeadCard({
  lead,
  onDelete,
  onConvertToOrcamento,
  onRequestMove,
  statusOptions,
  dndRef,
  dndListeners,
  dndAttributes,
  dndStyle,
  isDragging = false
}: LeadCardProps) {
  const [isPressing, setIsPressing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { statuses } = useLeadStatuses();

  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(lead.dataCriacao), { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return 'Data inválida';
    }
  }, [lead.dataCriacao]);

  const isConverted = lead.status === 'convertido';
  const isLost = lead.status === 'perdido';
  
  const statusColor = useMemo(() => {
    const status = statuses.find(s => s.key === lead.status);
    return status?.color || '#6b7280'; // gray fallback
  }, [lead.status, statuses]);

  const handleStartConversation = () => {
    try {
      const telefone = lead.telefone.replace(/\D/g, '');
      const mensagem = `Olá ${lead.nome}! 😊\n\nVi que você demonstrou interesse em nossos serviços. Como posso ajudá-lo(a)?`;
      const mensagemCodificada = encodeURIComponent(mensagem);
      const link = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
      window.open(link, '_blank');
      
      toast.success('WhatsApp aberto para conversa');
      // Move para "interessado" se ainda estiver em "novo_contato"
      if (lead.status === 'novo_contato') {
        onRequestMove?.('interessado');
      }
    } catch (error) {
      toast.error('Erro ao abrir WhatsApp');
    }
  };

  return (
    <li 
      className={`relative overflow-hidden rounded-lg p-2 transition-all cursor-grab active:cursor-grabbing select-none touch-none transform-gpu border ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${isPressing ? 'scale-[0.98]' : ''} 
      bg-gradient-to-br from-gray-100 to-white border-lunar-border shadow-sm
      dark:from-gray-800 dark:to-gray-700 dark:border-lunar-border
      `}
      style={dndStyle}
      ref={dndRef as any}
      {...dndAttributes || {}}
      {...dndListeners || {}}
      onPointerDownCapture={e => {
        const target = e.target as HTMLElement;
        if (target?.closest('[data-no-drag="true"]')) {
          e.stopPropagation();
        }
      }}
      onMouseDown={() => setIsPressing(true)}
      onMouseUp={() => setIsPressing(false)}
      onMouseLeave={() => setIsPressing(false)}
    >
      {/* Barra lateral colorida para identificação do status */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: statusColor }}
      />
      
      {/* Layout em Grid: Nome + Menu no topo */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-xs font-medium text-lunar-text leading-tight">
          {lead.nome}
        </h3>
        
        <LeadActionsPopover
          lead={lead}
          onStartConversation={handleStartConversation}
          onShowDetails={() => setShowDetails(true)}
          onConvert={onConvertToOrcamento}
          onDelete={onDelete}
        >
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 -mt-1 -mr-1" 
            title="Mais opções"
            data-no-drag="true"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </LeadActionsPopover>
      </div>

      {/* Badge de Origem */}
      {lead.origem && (
        <div className="mb-3">
          <Badge 
            className="text-xs px-2 py-1"
            style={{ 
              backgroundColor: `${statusColor}20`,
              color: statusColor,
              borderColor: `${statusColor}40`
            }}
          >
            {lead.origem}
          </Badge>
        </div>
      )}

      {/* Status Selector Centralizado */}
      <div className="flex justify-center mb-3">
        <LeadStatusSelector
          lead={lead}
          onStatusChange={(status) => {
            onRequestMove?.(status);
            toast.success('Status alterado');
          }}
        />
      </div>

      {/* Última alteração + WhatsApp */}
      <div className="flex items-center justify-between text-xs text-lunar-textSecondary">
        <span>Última alteração: {timeAgo}</span>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
          onClick={handleStartConversation}
          title="Conversar no WhatsApp"
          data-no-drag="true"
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* Details Modal */}
      <LeadDetailsModal
        lead={lead}
        open={showDetails}
        onOpenChange={setShowDetails}
        onConvert={onConvertToOrcamento}
        onDelete={onDelete}
      />
    </li>
  );
}