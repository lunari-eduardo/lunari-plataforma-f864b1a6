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
import LeadLossReasonModal from './LeadLossReasonModal';
import type { Lead } from '@/types/leads';
import type { PeriodFilter } from '@/hooks/useLeadMetrics';
import { cn } from '@/lib/utils';

export interface LeadsKanbanProps {
  periodFilter?: PeriodFilter;
  searchTerm: string;
  origemFilter: string;
}

export default function LeadsKanban({ periodFilter, searchTerm, origemFilter }: LeadsKanbanProps) {
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [schedulingModalOpen, setSchedulingModalOpen] = useState(false);
  const [leadToSchedule, setLeadToSchedule] = useState<Lead | null>(null);
  const [schedulingLead, setSchedulingLead] = useState<Lead | null>(null);
  const [lossReasonModalOpen, setLossReasonModalOpen] = useState(false);
  const [leadForLossReason, setLeadForLossReason] = useState<Lead | null>(null);
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
      const matchesSearch = !searchTerm.trim() || 
        lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lead.telefone.includes(searchTerm);
      
      const matchesOrigem = origemFilter === 'all' || lead.origem === origemFilter;
      
      // Apply period filter if provided
      let matchesPeriod = true;
      if (periodFilter) {
        const convertPeriodTypeToFilter = (periodType: string) => {
          const currentYear = new Date().getFullYear();
          
          switch (periodType) {
            case 'current_year':
              return { year: currentYear, month: undefined };
            case 'january_2025': return { year: 2025, month: 1 };
            case 'february_2025': return { year: 2025, month: 2 };
            case 'march_2025': return { year: 2025, month: 3 };
            case 'april_2025': return { year: 2025, month: 4 };
            case 'may_2025': return { year: 2025, month: 5 };
            case 'june_2025': return { year: 2025, month: 6 };
            case 'july_2025': return { year: 2025, month: 7 };
            case 'august_2025': return { year: 2025, month: 8 };
            case 'september_2025': return { year: 2025, month: 9 };
            case 'october_2025': return { year: 2025, month: 10 };
            case 'november_2025': return { year: 2025, month: 11 };
            case 'december_2025': return { year: 2025, month: 12 };
            case 'previous_year':
              return { year: currentYear - 1, month: undefined };
            case 'all_time':
            default:
              return { year: undefined, month: undefined };
          }
        };

        const { year, month } = convertPeriodTypeToFilter(periodFilter.periodType);
        
        if (year || month) {
          const date = new Date(lead.dataCriacao);
          const leadMonth = date.getMonth() + 1;
          const leadYear = date.getFullYear();
          
          if (year && month) {
            matchesPeriod = leadMonth === month && leadYear === year;
          } else if (year) {
            matchesPeriod = leadYear === year;
          }
        }
      }
      
      return matchesSearch && matchesOrigem && matchesPeriod;
    });
  }, [leads, searchTerm, origemFilter, periodFilter]);
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

    // Check if moving to lost status
    if (newStatus === 'perdido') {
      // Open loss reason modal
      setLeadForLossReason(lead);
      setLossReasonModalOpen(true);
      
      // Update lead status but wait for reason
      updateLead(lead.id, {
        status: newStatus,
        perdidoEm: new Date().toISOString()
      });
      
      // Add interaction for status change
      addInteraction(lead.id, 'mudanca_status', `Status alterado para "${statusName}"`, true, `Movido via Kanban`, lead.status, newStatus);
      
      toast({
        title: 'Lead movido',
        description: `${lead.nome} movido para ${statusName}`
      });
      return;
    }

    // Update lead status for non-lost statuses
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

  const handleLossReasonConfirm = (leadId: string, reason: string) => {
    updateLead(leadId, {
      motivoPerda: reason
    });
    
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      addInteraction(leadId, 'manual', `Motivo da perda definido: ${reason}`, false, 'Motivo selecionado pelo usuário');
      toast({
        title: 'Motivo Registrado',
        description: `Motivo da perda foi registrado para ${lead.nome}`
      });
    }
  };

  const handleLossReasonSkip = (leadId: string) => {
    // Lead already marked as lost, just close modal
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      addInteraction(leadId, 'manual', 'Motivo da perda será definido posteriormente', false, 'Usuário optou por definir motivo mais tarde');
    }
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

      {/* Lead Loss Reason Modal */}
      <LeadLossReasonModal
        open={lossReasonModalOpen}
        onOpenChange={(open) => {
          setLossReasonModalOpen(open);
          if (!open) {
            setLeadForLossReason(null);
          }
        }}
        lead={leadForLossReason}
        onConfirm={handleLossReasonConfirm}
        onSkip={handleLossReasonSkip}
      />
    </div>;
}