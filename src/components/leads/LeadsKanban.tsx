import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
import SchedulingConfirmationModal from './SchedulingConfirmationModal';
import type { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
export default function LeadsKanban() {
  const {
    leads,
    addLead,
    updateLead,
    deleteLead,
    convertToOrcamento
  } = useLeads();
  const {
    statuses,
    getConvertedKey
  } = useLeadStatuses();
  const {
    addInteraction
  } = useLeadInteractions();
  const {
    origens
  } = useAppContext();
  const {
    toast
  } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [origemFilter, setOrigemFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [schedulingModalOpen, setSchedulingModalOpen] = useState(false);
  const [leadToSchedule, setLeadToSchedule] = useState<Lead | null>(null);
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 4
    }
  });
  const sensors = useSensors(pointerSensor);
  const statusOptions = useMemo(() => statuses.map(s => ({
    value: s.key,
    label: s.name
  })), [statuses]);
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = !searchTerm.trim() || lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) || lead.email.toLowerCase().includes(searchTerm.toLowerCase()) || lead.telefone.includes(searchTerm);
      const matchesOrigem = origemFilter === 'all' || lead.origem === origemFilter;
      return matchesSearch && matchesOrigem;
    });
  }, [leads, searchTerm, origemFilter]);
  const groupedLeads = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    statuses.forEach(s => {
      groups[s.key] = [];
    });
    filteredLeads.forEach(lead => {
      (groups[lead.status] ||= []).push(lead);
    });
    return groups;
  }, [filteredLeads, statuses]);
  const handleStatusChange = (lead: Lead, newStatus: string) => {
    const statusName = statuses.find(s => s.key === newStatus)?.name || newStatus;
    const convertedKey = getConvertedKey();

    // Update lead status
    updateLead(lead.id, { status: newStatus });

    // Add interaction for status change
    addInteraction(lead.id, 'mudanca_status', `Status alterado para "${statusName}"`, true, `Movido via Kanban`, lead.status, newStatus);

    // Handle follow-up activation for 'proposta_enviada'
    if (newStatus === 'proposta_enviada') {
      // Reset follow-up timer
      updateLead(lead.id, { 
        needsFollowUp: false,
        statusTimestamp: new Date().toISOString()
      });
      
      addInteraction(lead.id, 'followup', 'Timer de follow-up iniciado', true, 'Contagem iniciada para follow-up automático');
    }

    // Handle scheduling confirmation for converted leads
    if (newStatus === convertedKey) {
      setLeadToSchedule(lead);
      setSchedulingModalOpen(true);
    }

    toast({
      title: 'Lead movido',
      description: `${lead.nome} movido para ${statusName}`
    });
  };

  const handleScheduled = (leadId: string, appointmentId: string) => {
    updateLead(leadId, {
      scheduledAppointmentId: appointmentId,
      needsScheduling: false
    });
    
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      addInteraction(leadId, 'manual', 'Cliente agendado com sucesso', false, `Agendamento criado: ${appointmentId}`);
      toast({
        title: 'Cliente Agendado',
        description: `${lead.nome} foi agendado com sucesso!`
      });
    }
  };

  const handleNotScheduled = (leadId: string) => {
    updateLead(leadId, {
      needsScheduling: true,
      scheduledAppointmentId: undefined
    });
    
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      addInteraction(leadId, 'manual', 'Agendamento adiado', false, 'Cliente convertido mas agendamento foi adiado');
      toast({
        title: 'Agendamento Adiado',
        description: `${lead.nome} está marcado para agendar.`
      });
    }
  };

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
  const StatusColumn = ({
    title,
    statusKey
  }: {
    title: string;
    statusKey: string;
  }) => {
    const {
      isOver,
      setNodeRef
    } = useDroppable({
      id: statusKey
    });
    const leadsInColumn = groupedLeads[statusKey] || [];

    // Buscar cor do status
    const statusColor = statuses.find(s => s.key === statusKey)?.color || '#6b7280';
    return <section className="flex-1 min-w-[240px]">
        <header className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{
            backgroundColor: statusColor
          }} />
            <h2 className="text-sm font-semibold text-lunar-text">{title}</h2>
          </div>
          <Badge variant="outline" className="text-2xs">
            {leadsInColumn.length}
          </Badge>
        </header>
        
        <Card ref={setNodeRef} className={cn("p-2 pb-4 border-lunar-border/60 min-h-[70vh] transition-colors", isOver ? "ring-2 ring-lunar-accent/60" : "")} style={{
        backgroundColor: `${statusColor}08`,
        // 8% opacity do background
        borderColor: `${statusColor}40` // 40% opacity da borda
      }}>
          <ul className="space-y-2">
            {leadsInColumn.map(lead => <DraggableLeadCard key={lead.id} lead={lead} onDelete={() => {
            deleteLead(lead.id);
            toast({
              title: 'Lead excluído'
            });
          }} onConvertToOrcamento={() => handleConvertToOrcamento(lead.id)} onRequestMove={status => {
            handleStatusChange(lead, status);
          }} statusOptions={statusOptions} activeId={activeId} />)}
            
            {leadsInColumn.length === 0 && <li className="text-center text-sm text-lunar-textSecondary py-8">
                Nenhum lead neste status
              </li>}
          </ul>
        </Card>
      </section>;
  };
  return <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-lunar-text">Leads</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setConfigModalOpen(true)} title="Configurar Follow-up">
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-3 bg-lunar-surface border-lunar-border/60 py-0">
        <div className="flex flex-nowrap whitespace-nowrap overflow-x-auto gap-2">
          <div className="flex-1 min-w-[200px]">
            <Input placeholder="Buscar leads..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="text-sm" />
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <Select value={origemFilter} onValueChange={setOrigemFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {origens.map(origem => <SelectItem key={origem.id} value={origem.nome}>
                    {origem.nome}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={rectIntersection} modifiers={[restrictToFirstScrollableAncestor]} onDragStart={e => {
        setActiveId(String(e.active.id));
      }} onDragEnd={e => {
        const overId = e.over?.id as string | undefined;
        if (activeId && overId) {
          const current = leads.find(lead => lead.id === activeId);
          if (current && current.status !== overId) {
            handleStatusChange(current, overId);
          }
        }
        setActiveId(null);
      }} onDragCancel={() => setActiveId(null)}>
        <div className="overflow-x-auto scrollbar-lunar">
          <div className="flex gap-2 min-w-max pr-2">
            {statuses.map(status => <StatusColumn key={status.id} title={status.name} statusKey={status.key} />)}
          </div>
        </div>

        <DragOverlay>
          <div className="pointer-events-none">
            {activeId ? (() => {
              const lead = leads.find(l => l.id === activeId);
              return lead ? <LeadCard lead={lead} onDelete={() => {}} onConvertToOrcamento={() => {}} statusOptions={statusOptions} isDragging={true} /> : null;
            })() : null}
          </div>
        </DragOverlay>
      </DndContext>

      {/* Modals */}
      <LeadFormModal open={createModalOpen} onOpenChange={setCreateModalOpen} mode="create" onSubmit={data => {
      try {
        const newLead = addLead(data);

        // Add creation interaction
        addInteraction(newLead.id, 'criacao', `Lead criado com status "${statuses.find(s => s.key === data.status)?.name || data.status}"`, true, `Cliente criado automaticamente no CRM`);
        toast({
          title: 'Lead criado',
          description: data.nome
        });
      } catch (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível criar o lead'
        });
      }
    }} />


      {/* Follow-up Config Modal */}
      <FollowUpConfigModal open={configModalOpen} onOpenChange={setConfigModalOpen} />

      {/* Scheduling Confirmation Modal */}
      {leadToSchedule && (
        <SchedulingConfirmationModal
          open={schedulingModalOpen}
          onOpenChange={setSchedulingModalOpen}
          lead={leadToSchedule}
          onScheduled={(appointmentId) => handleScheduled(leadToSchedule.id, appointmentId)}
          onNotScheduled={() => handleNotScheduled(leadToSchedule.id)}
        />
      )}
    </div>;
}