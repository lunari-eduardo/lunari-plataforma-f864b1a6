import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Mail, Phone, MessageSquare, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';
import type { Lead } from '@/types/leads';
import LeadHistoryPanel from './LeadHistoryPanel';

interface LeadDetailsModalProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConvert?: () => void;
  onDelete?: () => void;
}

export default function LeadDetailsModal({ 
  lead, 
  open, 
  onOpenChange, 
  onConvert, 
  onDelete 
}: LeadDetailsModalProps) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto scrollbar-elegant">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Detalhes do Lead</span>
            {lead.origem && (
              <Badge variant="secondary" className="text-xs">
                {lead.origem}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações básicas */}
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-lunar-text mb-3">Informações de Contato</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-lunar-accent/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-lunar-accent">
                      {lead.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-lunar-text">{lead.nome}</p>
                    <p className="text-xs text-lunar-textSecondary">Lead</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-lunar-textSecondary">
                  <Mail className="h-4 w-4" />
                  <span>{lead.email}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-lunar-textSecondary">
                  <Phone className="h-4 w-4" />
                  <span>{lead.telefone}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-lunar-textSecondary">
                  <Calendar className="h-4 w-4" />
                  <span>Criado {timeAgo}</span>
                </div>
              </div>
            </div>

            {/* Observações */}
            {lead.observacoes && (
              <div>
                <h3 className="font-medium text-lunar-text mb-2">Observações</h3>
                <div className="bg-lunar-surface border border-lunar-border rounded-md p-3">
                  <p className="text-sm text-lunar-textSecondary">{lead.observacoes}</p>
                </div>
              </div>
            )}

            {/* Status e Follow-up */}
            <div>
              <h3 className="font-medium text-lunar-text mb-2">Status</h3>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={isConverted ? "default" : isLost ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {lead.status}
                </Badge>
                {lead.needsFollowUp && (
                  <Badge variant="destructive" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    Follow-up
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Histórico de interações */}
          <div>
            <h3 className="font-medium text-lunar-text mb-3">Histórico de Interações</h3>
            <LeadHistoryPanel lead={lead} />
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-4 border-t border-lunar-border">
            {!isConverted && !isLost && onConvert && (
              <Button onClick={onConvert} className="flex-1">
                <MessageSquare className="h-4 w-4 mr-2" />
                Converter para Orçamento
              </Button>
            )}
            {onDelete && (
              <Button 
                variant="destructive" 
                onClick={onDelete}
                className="px-4"
              >
                Excluir Lead
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}