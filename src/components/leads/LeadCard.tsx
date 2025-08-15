import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MoreVertical, MessageCircle } from 'lucide-react';
import type { Lead } from '@/types/leads';
import LeadActionsPopover from './LeadActionsPopover';
import LeadStatusSelector from './LeadStatusSelector';
import LeadDetailsModal from './LeadDetailsModal';
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

  const isConverted = lead.status === 'convertido';
  const isLost = lead.status === 'perdido';

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
    <>
      <li 
        className={`relative overflow-hidden rounded-lg p-4 transition-all duration-200 cursor-grab active:cursor-grabbing select-none touch-none transform-gpu
          bg-gradient-to-br from-gray-50 to-white border border-gray-200/60 shadow-sm hover:shadow-md
          ${isDragging ? 'opacity-70 border-dashed ring-2 ring-blue-300/40 shadow-lg' : ''}
          ${isPressing ? 'ring-2 ring-blue-300/50 shadow-md' : ''}
          ${isConverted ? 'from-green-50 to-green-25 border-green-200' : ''}
          ${isLost ? 'from-red-50 to-red-25 border-red-200' : ''}
        `}
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
        {/* Layout Grid 3x3 */}
        <div className="grid grid-rows-3 h-24 gap-2">
          {/* Top Row - Menu de 3 pontos no canto direito */}
          <div className="flex justify-end">
            <LeadActionsPopover
              lead={lead}
              onStartConversation={handleStartConversation}
              onShowDetails={() => setShowDetails(true)}
              onConvert={!isConverted && !isLost ? onConvertToOrcamento : undefined}
              onDelete={onDelete}
            >
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-gray-400 hover:text-gray-600" 
                title="Mais opções"
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </LeadActionsPopover>
          </div>

          {/* Middle Row - Nome centralizado */}
          <div className="flex items-center justify-center -mt-2 -mb-2">
            <h3 className="text-sm font-medium text-gray-800 text-center leading-tight px-2">
              {lead.nome}
            </h3>
          </div>

          {/* Bottom Row - Status no centro, WhatsApp no canto direito */}
          <div className="flex items-center justify-between">
            <div className="flex-1 flex justify-center">
              <LeadStatusSelector
                lead={lead}
                onStatusChange={(status) => {
                  onRequestMove?.(status);
                  toast.success('Status alterado');
                }}
              />
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={handleStartConversation}
              title="Iniciar conversa no WhatsApp"
              data-no-drag="true"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Status visual indicator */}
        <span 
          aria-hidden 
          className={`pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-lg ${
            isConverted ? 'bg-green-500' : isLost ? 'bg-red-500' : 'bg-blue-500'
          }`} 
        />
      </li>

      {/* Details Modal */}
      <LeadDetailsModal
        open={showDetails}
        onOpenChange={setShowDetails}
        lead={lead}
        onConvert={!isConverted && !isLost ? onConvertToOrcamento : undefined}
        onDelete={onDelete}
      />
    </>
  );
}