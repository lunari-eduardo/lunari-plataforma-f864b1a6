import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Calendar, Phone, Mail, MessageCircle, ChevronDown } from 'lucide-react';
import type { Lead } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AcoesLeadModal from './AcoesLeadModal';
import { useLeadActions } from '@/hooks/useLeadActions';

interface LeadCardProps {
  lead: Lead;
  onEdit: () => void;
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
  onEdit,
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
  const [showAcoesModal, setShowAcoesModal] = useState(false);
  const { iniciarConversaWhatsApp, enviarPDFPorWhatsApp } = useLeadActions();

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
          <h3 
            className="text-sm font-medium text-lunar-text truncate cursor-pointer hover:text-lunar-accent" 
            onClick={onEdit}
            data-no-drag="true"
            title="Editar lead"
          >
            {lead.nome}
          </h3>
          
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

          {/* Botões de Ação */}
          <div className="mt-3 flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAcoesModal(true)}
              className="flex-1 h-8 text-xs"
              data-no-drag="true"
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              Ações
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="h-8 text-xs"
                  data-no-drag="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  Mover
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100]">
                {statusOptions.map(opt => (
                  <DropdownMenuItem 
                    key={opt.value} 
                    onSelect={() => onRequestMove?.(opt.value)}
                    disabled={opt.value === lead.status}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-start gap-1 shrink-0">
          {!isConverted && !isLost && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-7 text-xs" 
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

      <AcoesLeadModal
        lead={lead}
        isOpen={showAcoesModal}
        onClose={() => setShowAcoesModal(false)}
        onIniciarConversa={() => iniciarConversaWhatsApp(lead)}
        onEnviarPDF={() => enviarPDFPorWhatsApp}
      />
    </li>
  );
}