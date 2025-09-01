import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { DndContext, rectIntersection, useSensor, useSensors, PointerSensor, DragOverlay, useDroppable } from '@dnd-kit/core';
import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLeads } from '@/hooks/useLeads';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useLeadInteractions } from '@/hooks/useLeadInteractions';
import { useAppContext } from '@/contexts/AppContext';
import { convertPeriodTypeToFilter, filterLeadsByPeriod } from '@/utils/leadFilters';
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
  searchTerm?: string;
  originFilter?: string;
  isMobile?: boolean;
}

export default function LeadsKanban({ periodFilter, searchTerm = '', originFilter = 'all', isMobile = false }: LeadsKanbanProps) {
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
      distance: 8
    }
  });
  const sensors = useSensors(pointerSensor);
  const statusOptions = useMemo(() => statuses.map(s => ({
    value: s.key,
    label: s.name
  })), [statuses]);
  const filteredLeads = useMemo(() => {
    let baseLeads = leads;
    
    // Apply period filter first using centralized utility
    if (periodFilter) {
      const filter = convertPeriodTypeToFilter(periodFilter.periodType);
      baseLeads = filterLeadsByPeriod(leads, filter);
    } else {
      // Default to non-archived leads
      baseLeads = leads.filter(lead => !lead.arquivado);
    }
    
    // Then apply search and origin filters
    return baseLeads.filter(lead => {
      const matchesSearch = !searchTerm.trim() || 
        lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lead.telefone.includes(searchTerm);
      
      const matchesOrigem = originFilter === 'all' || lead.origem === originFilter;
      
      return matchesSearch && matchesOrigem;
    });
  }, [leads, searchTerm, originFilter, periodFilter]);
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
    return <section className={cn(
      "h-full flex flex-col",
      isMobile ? "flex-1 min-w-[240px]" : "flex-1 min-w-[280px]"
    )}>
        <header className={cn(
          "flex items-center justify-between px-1",
          isMobile ? "mb-1.5" : "mb-3"
        )}>
          <div className="flex items-center gap-2">
            <div className={cn(
              "rounded-full",
              isMobile ? "w-2 h-2" : "w-3 h-3"
            )} style={{
              backgroundColor: statusColor
            }} />
            <h2 className={cn(
              "font-semibold text-lunar-text",
              isMobile ? "text-xs" : "text-sm"
            )}>{title}</h2>
          </div>
          <Badge variant="outline" className={cn(
            isMobile ? "text-[10px] px-1 py-0" : "text-2xs"
          )}>
            {leadsInColumn.length}
          </Badge>
        </header>
        
        <Card 
          ref={setNodeRef} 
          className={cn(
            "flex-1 border-lunar-border/60 transition-colors overflow-hidden flex flex-col",
            isMobile ? "p-1" : "p-2",
            isOver ? "ring-2 ring-lunar-accent/60" : ""
          )} 
          style={{
            backgroundColor: `${statusColor}08`,
            borderColor: `${statusColor}40`
          }}
        >
          <div className="flex-1 overflow-y-auto scrollbar-kanban">
            <ul className={cn(
              "pb-2",
              isMobile ? "space-y-1" : "space-y-2"
            )}>
              {leadsInColumn.map(lead => <DraggableLeadCard key={lead.id} lead={lead} onDelete={() => {
              deleteLead(lead.id);
              toast({
                title: 'Lead excluído'
              });
            }} onConvertToClient={() => handleConvertToClient(lead.id)} onRequestMove={status => {
              handleStatusChange(lead, status);
            }} statusOptions={statusOptions} activeId={activeId} onScheduleClient={() => handleScheduleClient(lead)} onMarkAsScheduled={() => handleMarkAsScheduled(lead.id)} onViewAppointment={() => handleViewAppointment(lead)} onDirectScheduling={() => handleDirectScheduling(lead)} />)}
              
              {leadsInColumn.length === 0 && <li className={cn(
                "text-center text-lunar-textSecondary",
                isMobile ? "text-xs py-4" : "text-sm py-8"
              )}>
                  Nenhum lead neste status
                </li>}
            </ul>
          </div>
        </Card>
      </section>;
  };
  return <div className="flex flex-col h-full">
      {/* Header - More compact on mobile */}
      <div className={cn(
        "flex items-center justify-between",
        isMobile ? "px-2 py-1.5" : "px-2 py-3"
      )}>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "icon"} 
            onClick={() => setConfigModalOpen(true)} 
            title="Configurar Follow-up"
            className={cn(isMobile && "h-8")}
          >
            <Settings className="h-4 w-4" />
            {isMobile && <span className="ml-1 text-xs">Config</span>}
          </Button>
          <Button 
            onClick={() => setCreateModalOpen(true)}
            size={isMobile ? "sm" : "default"}
            className={cn(isMobile && "h-8 text-xs")}
          >
            {isMobile ? "Novo" : "Novo Lead"}
          </Button>
        </div>
        
        {/* Indicador de visualização arquivados */}
        {periodFilter?.periodType === 'archived' && (
          <div className="flex items-center gap-2 px-3 py-1 bg-chart-orange-1/10 border border-chart-orange-1/20 rounded-lg">
            <div className="w-2 h-2 bg-chart-orange-1 rounded-full animate-pulse" />
            <span className={cn(
              "text-chart-orange-1 font-medium",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Visualizando Arquivados
            </span>
          </div>
        )}
      </div>

      {/* Kanban Board Container - Optimized for mobile scroll */}
      <div className="flex-1 relative overflow-hidden overscroll-x-contain">
        <DndContext 
          sensors={sensors} 
          collisionDetection={rectIntersection} 
          onDragStart={e => {
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
          
          {/* Kanban Columns - Enhanced mobile scrolling */}
          <div className="absolute inset-0 overflow-x-auto overflow-y-hidden scrollbar-kanban">
            <div className={cn(
              "flex h-full min-w-max",
              isMobile ? "gap-1 px-1" : "gap-2 px-2"
            )}>
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