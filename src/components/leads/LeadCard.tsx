import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical, Calendar, Phone, Mail, History } from 'lucide-react';
import type { Lead } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import LeadActionsPopover from './LeadActionsPopover';
import LeadStatusSelector from './LeadStatusSelector';
import LeadHistoryPanel from './LeadHistoryPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const [showHistory, setShowHistory] = useState(false);

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
  const needsFollowUp = lead.needsFollowUp;

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
      className={`relative overflow-hidden rounded-md border border-lunar-border/60 bg-lunar-surface p-3 transition-none cursor-grab active:cursor-grabbing select-none touch-none transform-gpu ${
        isDragging ? 'opacity-70 border-dashed ring-1 ring-lunar-accent/40' : ''
      } ${isPressing ? 'ring-1 ring-lunar-accent/50' : ''} ${
        isConverted ? 'bg-green-50 border-green-200' : isLost ? 'bg-red-50 border-red-200' : ''
      }`}
      ref={dndRef as any}
      style={dndStyle}
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
      {/* Status visual indicator */}
      <span 
        aria-hidden 
        className={`pointer-events-none absolute inset-y-0 left-0 w-1 ${
          isConverted ? 'bg-green-500' : isLost ? 'bg-red-500' : 'bg-blue-500'
        }`} 
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <LeadActionsPopover
            lead={lead}
            onStartConversation={handleStartConversation}
          >
            <h3 
              className="text-sm font-medium text-lunar-text truncate cursor-pointer hover:text-lunar-accent" 
              data-no-drag="true"
              title="Clique para ver opções"
            >
              {lead.nome}
            </h3>
          </LeadActionsPopover>
          
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-1 text-xs text-lunar-textSecondary">
              <Mail className="h-3 w-3" />
              <span className="truncate">{lead.email}</span>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-lunar-textSecondary">
              <Phone className="h-3 w-3" />
              <span>{lead.telefone}</span>
            </div>

          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1">
            {lead.origem && (
              <Badge variant="secondary" className="text-[10px]">
                {lead.origem}
              </Badge>
            )}
            
            {needsFollowUp && (
              <Badge variant="destructive" className="text-[10px]">
                Follow-up
              </Badge>
            )}
            
            <div className="flex items-center gap-1 text-xs text-lunar-textSecondary">
              <Calendar className="h-3 w-3" />
              <span>{timeAgo}</span>
            </div>
          </div>

          {lead.observacoes && (
            <p className="mt-2 text-xs text-lunar-textSecondary line-clamp-2">
              {lead.observacoes}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <LeadStatusSelector
            lead={lead}
            onStatusChange={(status) => {
              onRequestMove?.(status);
              toast.success('Status alterado');
            }}
          />

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={() => setShowHistory(true)}
            title="Ver histórico"
            data-no-drag="true"
          >
            <History className="h-4 w-4" />
          </Button>

          <LeadActionsPopover
            lead={lead}
            onStartConversation={handleStartConversation}
          >
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              title="Mais opções"
              data-no-drag="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </LeadActionsPopover>

          {!isConverted && !isLost && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-7 text-2xs" 
              onClick={onConvertToOrcamento}
              data-no-drag="true"
            >
              Converter
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={onDelete}
            title="Excluir"
            data-no-drag="true"
          >
            ×
          </Button>
        </div>
      </div>

      {/* History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Histórico - {lead.nome}</DialogTitle>
          </DialogHeader>
          <LeadHistoryPanel lead={lead} />
        </DialogContent>
      </Dialog>
    </li>
  );
}