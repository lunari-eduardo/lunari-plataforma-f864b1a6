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
import { useNavigate } from 'react-router-dom';
import { useLeads } from '@/hooks/useLeads';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useLeadInteractions } from '@/hooks/useLeadInteractions';
import { useAppContext } from '@/contexts/AppContext';
import LeadCard from './LeadCard';
import LeadFormModal from './LeadFormModal';
import DraggableLeadCard from './DraggableLeadCard';
import FollowUpConfigModal from './FollowUpConfigModal';
import LeadSchedulingModal from './LeadSchedulingModal';
import type { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
export default function LeadsKanban() {
  const navigate = useNavigate();
  const {
    leads,
    addLead,
    updateLead,
    deleteLead,
    convertToClient
  } = useLeads();
  const {
    statuses,
    getConvertedKey
  } = useLeadStatuses();
  const {
    addInteraction
  } = useLeadInteractions();
  const {
    origens,
    setSelectedClientForScheduling
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
  const [schedulingLead, setSchedulingLead] = useState<Lead | null>(null);
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
    updateLead(lead.id, {
      status: newStatus
    });

    // Add interaction for status change
    addInteraction(lead.id, 'mudanca_status', `Status alterado para "${statusName}"`, true, `Movido via Kanban`, lead.status, newStatus);

    // Handle follow-up activation for 'orcamento_enviado'
    if (newStatus === 'orcamento_enviado') {
      // Reset follow-up timer
      updateLead(lead.id, {
        needsFollowUp: false,
        statusTimestamp: new Date().toISOString()
      });
      addInteraction(lead.id, 'followup', 'Timer de follow-up iniciado', true, 'Contagem iniciada para follow-up automático');
    }

    // Note: Direct scheduling button will be shown on card instead of modal
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
  const handleConvertToClient = (leadId: string) => {
    const cliente = convertToClient(leadId);
    if (cliente) {
      updateLead(leadId, {
        status: 'fechado'
      });
      toast({
        title: 'Lead Convertido',
        description: `${cliente.nome} foi convertido em cliente.`
      });
    }
  };
  const handleScheduleClient = (lead: Lead) => {
    setSchedulingLead(lead);
    setSchedulingModalOpen(true);
  };

  const handleDirectScheduling = (lead: Lead) => {
    // Set client for pre-selection in Agenda
    setSelectedClientForScheduling(lead.clienteId);
    // Navigate to Agenda page
    navigate('/agenda');
  };
  const handleMarkAsScheduled = (leadId: string) => {
    updateLead(leadId, {
      needsScheduling: false,
      scheduledAppointmentId: `manual_${Date.now()}`
    });
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      addInteraction(leadId, 'manual', 'Marcado como agendado manualmente', false, 'Cliente foi marcado como agendado sem criar agendamento específico');
      toast({
        title: 'Marcado como Agendado',
        description: `${lead.nome} foi marcado como agendado.`
      });
    }
  };
  const handleViewAppointment = (lead: Lead) => {
    if (lead.scheduledAppointmentId) {
      // Future: Navigate to agenda with appointment highlighted
      window.location.href = '/agenda';
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
    return <section className="flex-1 min-w-[280px] h-full flex flex-col">
        <header className="flex items-center justify-between mb-3 px-1">
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
        
        <Card ref={setNodeRef} className={cn("flex-1 p-2 border-lunar-border/60 transition-colors overflow-hidden flex flex-col", isOver ? "ring-2 ring-lunar-accent/60" : "")} style={{
        backgroundColor: `${statusColor}08`,
        borderColor: `${statusColor}40`
      }}>
          <div className="flex-1 overflow-y-auto scrollbar-kanban">
            <ul className="space-y-2 pb-2">
              {leadsInColumn.map(lead => <DraggableLeadCard key={lead.id} lead={lead} onDelete={() => {
              deleteLead(lead.id);
              toast({
                title: 'Lead excluído'
              });
            }} onConvertToClient={() => handleConvertToClient(lead.id)} onRequestMove={status => {
              handleStatusChange(lead, status);
            }} statusOptions={statusOptions} activeId={activeId} onScheduleClient={() => handleScheduleClient(lead)} onMarkAsScheduled={() => handleMarkAsScheduled(lead.id)} onViewAppointment={() => handleViewAppointment(lead)} onDirectScheduling={() => handleDirectScheduling(lead)} />)}
              
              {leadsInColumn.length === 0 && <li className="text-center text-sm text-lunar-textSecondary py-8">
                  Nenhum lead neste status
                </li>}
            </ul>
          </div>
        </Card>
      </section>;
  };
  return <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-3">
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
      <Card className="mx-2 mb-3 p-3 bg-lunar-surface border-lunar-border/60">
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

      {/* Kanban Board Container */}
      <div className="flex-1 relative">
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
          
          {/* Kanban Columns - Scrollable horizontally */}
          <div className="absolute inset-0 overflow-x-auto overflow-y-hidden scrollbar-kanban">
            <div className="flex h-full gap-2 min-w-max px-2">
              {statuses.map(status => <StatusColumn key={status.id} title={status.name} statusKey={status.key} />)}
            </div>
          </div>

          <DragOverlay>
            <div className="pointer-events-none">
              {activeId ? (() => {
              const lead = leads.find(l => l.id === activeId);
              return lead ? <LeadCard lead={lead} onDelete={() => {}} onConvertToClient={() => {}} statusOptions={statusOptions} isDragging={true} /> : null;
            })() : null}
            </div>
          </DragOverlay>
        </DndContext>
      </div>

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

      {/* Lead Scheduling Modal */}
      {(leadToSchedule || schedulingLead) && <LeadSchedulingModal open={schedulingModalOpen} onOpenChange={open => {
      setSchedulingModalOpen(open);
      if (!open) {
        setLeadToSchedule(null);
        setSchedulingLead(null);
      }
    }} lead={leadToSchedule || schedulingLead!} onScheduled={appointmentId => {
      const targetLead = leadToSchedule || schedulingLead;
      if (targetLead) {
        handleScheduled(targetLead.id, appointmentId);
        setLeadToSchedule(null);
        setSchedulingLead(null);
      }
    }} onSkip={() => {
      const targetLead = leadToSchedule || schedulingLead;
      if (targetLead) {
        handleNotScheduled(targetLead.id);
        setLeadToSchedule(null);
        setSchedulingLead(null);
      }
    }} />}
    </div>;
}