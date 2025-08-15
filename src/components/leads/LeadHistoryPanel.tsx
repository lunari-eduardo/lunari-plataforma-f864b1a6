import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, MessageCircle, TrendingUp, FileText, UserPlus, Plus } from 'lucide-react';
import { useLeadInteractions } from '@/hooks/useLeadInteractions';
import type { Lead } from '@/types/leads';
import type { LeadInteraction } from '@/types/leadInteractions';

interface LeadHistoryPanelProps {
  lead: Lead;
}

const InteractionIcon = ({ tipo }: { tipo: LeadInteraction['tipo'] }) => {
  switch (tipo) {
    case 'criacao': return <UserPlus className="h-4 w-4" />;
    case 'mudanca_status': return <TrendingUp className="h-4 w-4" />;
    case 'conversa': return <MessageCircle className="h-4 w-4" />;
    case 'orcamento': return <FileText className="h-4 w-4" />;
    case 'followup': return <Clock className="h-4 w-4" />;
    default: return <MessageCircle className="h-4 w-4" />;
  }
};

const InteractionBadge = ({ tipo, automatica }: { tipo: LeadInteraction['tipo']; automatica: boolean }) => {
  const getVariant = () => {
    if (tipo === 'followup') return 'destructive';
    if (automatica) return 'secondary';
    return 'default';
  };

  const getLabel = () => {
    switch (tipo) {
      case 'criacao': return 'Criado';
      case 'mudanca_status': return 'Status';
      case 'conversa': return 'Conversa';
      case 'orcamento': return 'Orçamento';
      case 'followup': return 'Follow-up';
      case 'manual': return 'Manual';
      default: return 'Interação';
    }
  };

  return (
    <Badge variant={getVariant()} className="text-xs">
      {getLabel()}
    </Badge>
  );
};

export default function LeadHistoryPanel({ lead }: LeadHistoryPanelProps) {
  const { addInteraction, getInteractionsForLead } = useLeadInteractions();
  const [newInteraction, setNewInteraction] = useState('');
  const [isAddingInteraction, setIsAddingInteraction] = useState(false);

  const interactions = getInteractionsForLead(lead);

  const handleAddManualInteraction = () => {
    if (!newInteraction.trim()) return;

    addInteraction(
      lead.id,
      'manual',
      newInteraction.trim(),
      false
    );

    setNewInteraction('');
    setIsAddingInteraction(false);
  };

  return (
    <Card className="bg-lunar-surface border-lunar-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-lunar-text">
            Histórico de Interações
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddingInteraction(!isAddingInteraction)}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add Manual Interaction */}
        {isAddingInteraction && (
          <div className="space-y-2 p-3 bg-lunar-bg rounded-md border border-lunar-border/60">
            <Textarea
              placeholder="Descreva a interação com o lead..."
              value={newInteraction}
              onChange={(e) => setNewInteraction(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddManualInteraction}>
                Salvar
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setIsAddingInteraction(false);
                  setNewInteraction('');
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Interactions List */}
        <ScrollArea className="h-[300px]">
          {interactions.length === 0 ? (
            <div className="text-center py-8 text-lunar-textSecondary text-sm">
              Nenhuma interação registrada ainda
            </div>
          ) : (
            <div className="space-y-3">
              {interactions.map((interaction) => (
                <div
                  key={interaction.id}
                  className="flex gap-3 p-3 bg-lunar-bg rounded-md border border-lunar-border/40"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="p-1 bg-lunar-surface rounded-full border border-lunar-border/60">
                      <InteractionIcon tipo={interaction.tipo} />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <InteractionBadge 
                        tipo={interaction.tipo} 
                        automatica={interaction.automatica} 
                      />
                      <span className="text-xs text-lunar-textSecondary">
                        {formatDistanceToNow(new Date(interaction.timestamp), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                    </div>
                    
                    <p className="text-sm text-lunar-text">
                      {interaction.descricao}
                    </p>
                    
                    {interaction.detalhes && (
                      <p className="text-xs text-lunar-textSecondary mt-1">
                        {interaction.detalhes}
                      </p>
                    )}
                    
                    {interaction.statusAnterior && interaction.statusNovo && (
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        <Badge variant="outline" className="text-2xs">
                          {interaction.statusAnterior}
                        </Badge>
                        <span className="text-lunar-textSecondary">→</span>
                        <Badge variant="outline" className="text-2xs">
                          {interaction.statusNovo}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}