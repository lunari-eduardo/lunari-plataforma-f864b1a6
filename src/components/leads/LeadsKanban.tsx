import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { DndContext, rectIntersection, useSensor, useSensors, PointerSensor, DragOverlay, useDroppable } from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { useLeads } from '@/hooks/useLeads';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useAppContext } from '@/contexts/AppContext';
import LeadCard from './LeadCard';
import LeadFormModal from './LeadFormModal';
import type { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';

interface DraggableLeadCardProps {
  lead: Lead;
  onEdit: () => void;
  onDelete: () => void;
  onConvertToOrcamento: () => void;
  onRequestMove: (status: string) => void;
  statusOptions: { value: string; label: string; }[];
  activeId: string | null;
}

function DraggableLeadCard({ lead, activeId, ...props }: DraggableLeadCardProps) {
  return (
    <LeadCard
      lead={lead}
      {...props}
      isDragging={activeId === lead.id}
    />
  );
}

export default function LeadsKanban() {
  const { leads, addLead, updateLead, deleteLead, convertToOrcamento } = useLeads();
  const { statuses, getConvertedKey } = useLeadStatuses();
  const { origens } = useAppContext();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [origemFilter, setOrigemFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

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
      <section className="flex-1 min-w-[280px]">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-lunar-text">{title}</h2>
          <Badge variant="outline" className="text-xs">
            {leadsInColumn.length}
          </Badge>
        </header>
        
        <Card
          ref={setNodeRef}
          className={cn(
            "p-3 bg-lunar-surface border-lunar-border/60 min-h-[70vh] max-h-[70vh] overflow-y-auto",
            isOver ? "ring-2 ring-lunar-accent/60" : ""
          )}
        >
          <ul className="space-y-3">
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-lunar-text">Leads</h2>
        <Button onClick={() => setCreateModalOpen(true)}>
          Novo Lead
        </Button>
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
              updateLead(activeId, { status: overId });
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

      {/* Modals */}
      <LeadFormModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        mode="create"
        onSubmit={(data) => {
          addLead(data);
          toast({ title: 'Lead criado', description: data.nome });
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
            toast({ title: 'Lead atualizado' });
          }}
        />
      )}
    </div>
  );
}