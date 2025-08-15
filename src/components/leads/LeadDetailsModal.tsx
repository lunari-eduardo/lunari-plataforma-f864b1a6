import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Calendar, User, MessageSquare } from 'lucide-react';
import type { Lead } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';
import LeadHistoryPanel from './LeadHistoryPanel';

interface LeadDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onConvert?: () => void;
  onDelete?: () => void;
}

export default function LeadDetailsModal({
  open,
  onOpenChange,
  lead,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalhes do Lead - {lead.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-lunar-text">Informações de Contato</h3>
            
            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-lunar-surface/50 border border-lunar-border/30">
                <Mail className="h-4 w-4 text-lunar-textSecondary" />
                <div>
                  <p className="text-xs text-lunar-textSecondary">Email</p>
                  <p className="text-sm text-lunar-text">{lead.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md bg-lunar-surface/50 border border-lunar-border/30">
                <Phone className="h-4 w-4 text-lunar-textSecondary" />
                <div>
                  <p className="text-xs text-lunar-textSecondary">Telefone</p>
                  <p className="text-sm text-lunar-text">{lead.telefone}</p>
                </div>
              </div>

              {lead.whatsapp && lead.whatsapp !== lead.telefone && (
                <div className="flex items-center gap-3 p-3 rounded-md bg-lunar-surface/50 border border-lunar-border/30">
                  <MessageSquare className="h-4 w-4 text-lunar-textSecondary" />
                  <div>
                    <p className="text-xs text-lunar-textSecondary">WhatsApp</p>
                    <p className="text-sm text-lunar-text">{lead.whatsapp}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metadados */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-lunar-text">Informações Adicionais</h3>
            
            <div className="grid gap-3">
              {lead.origem && (
                <div className="flex items-center justify-between p-3 rounded-md bg-lunar-surface/50 border border-lunar-border/30">
                  <span className="text-xs text-lunar-textSecondary">Origem</span>
                  <Badge variant="secondary" className="text-xs">
                    {lead.origem}
                  </Badge>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-md bg-lunar-surface/50 border border-lunar-border/30">
                <span className="text-xs text-lunar-textSecondary">Criado</span>
                <div className="flex items-center gap-1 text-xs text-lunar-textSecondary">
                  <Calendar className="h-3 w-3" />
                  {timeAgo}
                </div>
              </div>

              {lead.needsFollowUp && (
                <div className="flex items-center justify-between p-3 rounded-md bg-lunar-surface/50 border border-lunar-border/30">
                  <span className="text-xs text-lunar-textSecondary">Follow-up</span>
                  <Badge variant="destructive" className="text-xs">
                    Necessário
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Observações */}
          {lead.observacoes && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-lunar-text">Observações</h3>
              <div className="p-3 rounded-md bg-lunar-surface/50 border border-lunar-border/30">
                <p className="text-sm text-lunar-textSecondary whitespace-pre-wrap">
                  {lead.observacoes}
                </p>
              </div>
            </div>
          )}

          {/* Histórico */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-lunar-text">Histórico de Interações</h3>
            <div className="border border-lunar-border/30 rounded-md">
              <LeadHistoryPanel lead={lead} />
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-4 border-t border-lunar-border/30">
            {!isConverted && !isLost && onConvert && (
              <Button 
                onClick={() => {
                  onConvert();
                  onOpenChange(false);
                }}
                className="flex-1"
              >
                Converter em Orçamento
              </Button>
            )}
            
            {onDelete && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  onDelete();
                  onOpenChange(false);
                }}
                className="flex-1"
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