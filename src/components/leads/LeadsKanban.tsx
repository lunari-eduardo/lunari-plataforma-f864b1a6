import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { DndContext, rectIntersection, useSensor, useSensors, PointerSensor, DragOverlay, useDroppable } from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { Settings } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useLeadInteractions } from '@/hooks/useLeadInteractions';
import { useAppContext } from '@/contexts/AppContext';
import LeadCard from './LeadCard';
import LeadFormModal from './LeadFormModal';
import DraggableLeadCard from './DraggableLeadCard';
import FollowUpConfigModal from './FollowUpConfigModal';
import LeadDebugger from '../debug/LeadDebugger';
import type { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';

export default function LeadsKanban() {
  const { leads, addLead, updateLead, deleteLead, convertToOrcamento } = useLeads();
  const { statuses, getConvertedKey } = useLeadStatuses();
  const { addInteraction } = useLeadInteractions();
  const { origens } = useAppContext();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [origemFilter, setOrigemFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  const pointerSensor = useSensor(PointerSensor, { 
    activationConstraint: { distance: 4 } 
  });
  const sensors = useSensors(pointerSensor);

  const statusOptions = useMemo(() => 
    statuses.map(s => ({ value: s.key, label: s.name })), 
    [statuses]
  );

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = !searchTerm.trim() || 
        lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.telefone.includes(searchTerm);
      
      const matchesOrigem = origemFilter === 'all' || lead.origem === origemFilter;
      
      return matchesSearch && matchesOrigem;
    });
  }, [leads, searchTerm, origemFilter]);

  const groupedLeads = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    statuses.forEach(s => { groups[s.key] = []; });
    filteredLeads.forEach(lead => { 
      (groups[lead.status] ||= []).push(lead); 
    });
    return groups;
  }, [filteredLeads, statuses]);

  const handleConvertToOrcamento = (leadId: string) => {
    const result = convertToOrcamento(leadId);
    if (result) {
      toast({
        title: 'Lead Convertido',
        description: `${result.lead.nome} foi convertido em cliente e está pronto para orçamento.`
      });
      
      // Redirecionar para aba de novo orçamento com dados pré-preenchidos
      const searchParams = new URLSearchParams({
        clienteId: result.cliente.id,
        origem: result.dadosOrcamento.origem || '',
        observacoes: result.dadosOrcamento.observacoes || ''
      });
      
      // Usar navigate programaticamente ou window.location
      window.location.href = `/orcamentos?tab=novo&${searchParams.toString()}`;
    }
  };

  const StatusColumn = ({ title, statusKey }: { title: string; statusKey: string }) => {
    const { isOver, setNodeRef } = useDroppable({ id: statusKey });
    const leadsInColumn = groupedLeads[statusKey] || [];
    
    return (
      <section className="flex-1 min-w-[320px]">
        <header className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-lunar-text">{title}</h2>
          <Badge variant="outline" className="text-2xs">
            {leadsInColumn.length}
          </Badge>
        </header>
        
        <Card
          ref={setNodeRef}
          className={cn(
            "p-2 pb-8 bg-lunar-surface border-lunar-border/60 min-h-full",
            isOver ? "ring-2 ring-lunar-accent/60" : ""
          )}
        >
          <ul className="space-y-2">
            {leadsInColumn.map(lead => (
              <DraggableLeadCard
                key={lead.id}
                lead={lead}
                onEdit={() => setEditLead(lead)}
                onDelete={() => {
                  deleteLead(lead.id);
                  toast({ title: 'Lead excluído' });
                }}
                onConvertToOrcamento={() => handleConvertToOrcamento(lead.id)}
                onRequestMove={(status) => {
                  updateLead(lead.id, { status });
                  toast({ title: 'Lead movido' });
                }}
                statusOptions={statusOptions}
                activeId={activeId}
              />
            ))}
            
            {leadsInColumn.length === 0 && (
              <li className="text-center text-sm text-lunar-textSecondary py-8">
                Nenhum lead neste status
              </li>
            )}
          </ul>
        </Card>
      </section>
    );
  };

  return (
    <div className="space-y-4">
      {/* Debug Panel - TEMPORÁRIO */}
      <LeadDebugger />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-lunar-text">Leads</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setConfigModalOpen(true)}
            title="Configurar Follow-up"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4 bg-lunar-surface border-lunar-border/60">
        <div className="grid md:grid-cols-2 gap-3">
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <Select value={origemFilter} onValueChange={setOrigemFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              {origens.map(origem => (
                <SelectItem key={origem.id} value={origem.nome}>
                  {origem.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Kanban Board */}
      <ScrollArea className="h-[70vh]">
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          modifiers={[restrictToFirstScrollableAncestor]}
          onDragStart={(e) => {
            setActiveId(String(e.active.id));
          }}
          onDragEnd={(e) => {
            const overId = e.over?.id as string | undefined;
            if (activeId && overId) {
              const current = leads.find(lead => lead.id === activeId);
              if (current && current.status !== overId) {
                const statusName = statuses.find(s => s.key === overId)?.name || overId;
                const statusAnteriorName = statuses.find(s => s.key === current.status)?.name || current.status;
                
                updateLead(activeId, { status: overId });
                
                // Add interaction for status change
                addInteraction(
                  activeId,
                  'mudanca_status',
                  `Status alterado para "${statusName}"`,
                  true,
                  `Movido via Kanban`,
                  current.status,
                  overId
                );
                
                toast({ title: 'Lead movido' });
              }
            }
            setActiveId(null);
          }}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-max pr-2">
              {statuses.map(status => (
                <StatusColumn 
                  key={status.id} 
                  title={status.name} 
                  statusKey={status.key} 
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            <div className="pointer-events-none">
              {activeId ? (() => {
                const lead = leads.find(l => l.id === activeId);
                return lead ? (
                  <LeadCard
                    lead={lead}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onConvertToOrcamento={() => {}}
                    statusOptions={statusOptions}
                    isDragging={true}
                  />
                ) : null;
              })() : null}
            </div>
          </DragOverlay>
        </DndContext>
      </ScrollArea>

      {/* Modals */}
      <LeadFormModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        mode="create"
        onSubmit={(data) => {
          try {
            const newLead = addLead(data);
            
            // Add creation interaction
            addInteraction(
              newLead.id,
              'criacao',
              `Lead criado com status "${statuses.find(s => s.key === data.status)?.name || data.status}"`,
              true,
              `Cliente criado automaticamente no CRM`
            );
            
            toast({ title: 'Lead criado', description: data.nome });
          } catch (error) {
            toast({ title: 'Erro', description: 'Não foi possível criar o lead' });
          }
        }}
      />

      {editLead && (
        <LeadFormModal
          open={!!editLead}
          onOpenChange={(open) => !open && setEditLead(null)}
          mode="edit"
          initial={editLead}
          onSubmit={(data) => {
            updateLead(editLead.id, data);
            
            // Add edit interaction
            addInteraction(
              editLead.id,
              'manual',
              'Informações do lead atualizadas',
              false,
              'Editado pelo usuário'
            );
            
            toast({ title: 'Lead atualizado' });
          }}
        />
      )}

      {/* Follow-up Config Modal */}
      <FollowUpConfigModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
      />
    </div>
  );
}