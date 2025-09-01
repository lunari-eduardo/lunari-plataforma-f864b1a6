import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { DndContext, rectIntersection, useSensor, useSensors, PointerSensor, DragOverlay, useDroppable } from '@dnd-kit/core';
import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLeads } from '@/hooks/useLeads';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useAppContext } from '@/contexts/AppContext';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Lead } from '@/types/leads';
import DraggableLeadCard from './DraggableLeadCard';
import LeadFormModal from './LeadFormModal';
import LeadSchedulingModal from './LeadSchedulingModal';
import LeadLossReasonModal from './LeadLossReasonModal';
import SchedulingConfirmationModal from './SchedulingConfirmationModal';
import FollowUpConfigModal from './FollowUpConfigModal';
import FollowUpNotificationCard from './FollowUpNotificationCard';
import { convertPeriodTypeToFilter, filterLeadsByPeriod } from '@/utils/leadFilters';
import type { PeriodFilter } from '@/hooks/useLeadMetrics';

interface LeadsKanbanProps {
  periodFilter: PeriodFilter;
  searchTerm: string;
  originFilter: string;
  isMobile: boolean;
}

interface DropZoneProps {
  status: string;
  children: React.ReactNode;
  statusColor: string;
}

function DropZone({ status, children, statusColor }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const isMobile = useIsMobile();
  
  return (
    <div className="flex-1 flex flex-col min-w-0">
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
          {children}
        </div>
      </Card>
    </div>
  );
}

export default function LeadsKanban({
  periodFilter,
  searchTerm,
  originFilter,
  isMobile
}: LeadsKanbanProps) {
  const { leads, updateLead, deleteLead } = useLeads();
  const { statuses } = useLeadStatuses();
  const { 
    origens,
    setSelectedClientForScheduling 
  } = useAppContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [schedulingModalOpen, setSchedulingModalOpen] = useState(false);
  const [leadToSchedule, setLeadToSchedule] = useState<Lead | null>(null);
  const [schedulingLead, setSchedulingLead] = useState<Lead | null>(null);
  const [lossReasonModalOpen, setLossReasonModalOpen] = useState(false);
  const [leadForLossReason, setLeadForLossReason] = useState<Lead | null>(null);
  
  const statusOptions = useMemo(() => statuses.map(s => ({
    value: s.key,
    label: s.name
  })), [statuses]);

  const filteredLeads = useMemo(() => {
    let baseLeads = leads;
    
    // Apply period filter first using centralized utility
    if (periodFilter) {
      const filter = convertPeriodTypeToFilter(periodFilter.periodType);
      baseLeads = filterLeadsByPeriod(baseLeads, filter);
    }

    // Apply origem filter
    if (originFilter && originFilter !== 'all') {
      baseLeads = baseLeads.filter(lead => lead.origem === originFilter);
    }

    // Apply name search
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      baseLeads = baseLeads.filter(lead => 
        lead && lead.nome && (
          lead.nome.toLowerCase().includes(query) ||
          lead.telefone?.includes(query) ||
          (lead.email && lead.email.toLowerCase().includes(query))
        )
      );
    }

    return baseLeads;
  }, [leads, periodFilter, originFilter, searchTerm]);

  const handleStatusChange = (lead: Lead, newStatus: string) => {
    if (newStatus === 'perdido' && !lead.motivoPerda) {
      setLeadForLossReason(lead);
      setLossReasonModalOpen(true);
      return;
    }

    updateLead(lead.id, { 
      status: newStatus,
      statusTimestamp: new Date().toISOString()
    });
  };

  const handleConvertToClient = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // Mark as converted first
    updateLead(leadId, { 
      status: 'fechado',
      statusTimestamp: new Date().toISOString()
    });
    
    // Navigate to create client with prefilled data
    navigate('/clientes', {
      state: {
        createClient: true,
        prefillData: {
          nome: lead.nome,
          telefone: lead.telefone,
          email: lead.email,
          origem: lead.origem,
          leadId: leadId
        }
      }
    });
  };

  const handleScheduleClient = (lead: Lead) => {
    setLeadToSchedule(lead);
    setSchedulingModalOpen(true);
  };

  const handleMarkAsScheduled = (leadId: string) => {
    updateLead(leadId, { 
      needsScheduling: false,
      scheduledAppointmentId: `temp-${Date.now()}` // Temporary ID until real appointment is created
    });
    toast({ title: 'Lead marcado como agendado' });
  };

  const handleViewAppointment = (lead: Lead) => {
    if (lead.scheduledAppointmentId) {
      navigate('/agenda', { 
        state: { 
          highlightAppointment: lead.scheduledAppointmentId 
        } 
      });
    }
  };

  const handleDirectScheduling = (lead: Lead) => {
    if (lead.clienteId) {
      setSelectedClientForScheduling(lead.clienteId);
      navigate('/agenda');
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const leadId = String(active.id);
    const newStatus = String(over.id);
    const lead = leads.find(l => l.id === leadId);
    
    if (!lead) return;

    handleStatusChange(lead, newStatus);
  };

  const activeItem = activeId ? leads.find(l => l.id === activeId) : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 p-4 border-b border-lunar-border bg-lunar-surface/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-lunar-text">Leads</h1>
            <Badge variant="outline" className="text-xs">
              {filteredLeads.length} leads
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setConfigModalOpen(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              {isMobile ? "" : "Configurar Follow-up"}
            </Button>
            <Button onClick={() => setCreateModalOpen(true)}>
              {isMobile ? "+ Lead" : "+ Novo Lead"}
            </Button>
          </div>
        </div>

        <FollowUpNotificationCard />
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 relative overflow-hidden">
        <DndContext 
          sensors={sensors} 
          collisionDetection={rectIntersection} 
          onDragStart={e => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
        >
          <div className={cn(
            "flex h-full gap-2 p-2 overflow-x-auto scrollbar-elegant",
            isMobile && "gap-1 p-1"
          )}>
            {statuses.map(status => {
              const leadsInColumn = filteredLeads.filter(lead => lead.status === status.key);
              
              return (
                <div key={status.key} className={cn(
                  "flex flex-col min-w-0",
                  isMobile ? "flex-1 min-w-[200px]" : "flex-1 min-w-[280px]"
                )}>
                  {/* Column Header */}
                  <header className={cn(
                    "mb-2 p-2 rounded-t-lg border border-b-0 border-lunar-border/60",
                    isMobile ? "p-1" : "p-2"
                  )} style={{
                    backgroundColor: `${status.color}15`,
                    borderColor: `${status.color}40`
                  }}>
                    <div className="flex items-center justify-between">
                      <h2 className={cn(
                        "font-semibold text-lunar-text",
                        isMobile ? "text-xs" : "text-sm"
                      )}>{status.name}</h2>
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "text-xs font-normal",
                          isMobile ? "text-2xs px-1" : "text-xs px-2"
                        )}
                        style={{ 
                          backgroundColor: `${status.color}20`,
                          color: status.color,
                          borderColor: `${status.color}40`
                        }}
                      >
                        {leadsInColumn.length}
                      </Badge>
                    </div>
                  </header>
                  
                  <DropZone status={status.key} statusColor={status.color}>
                    <ul className={cn(
                      "pb-2",
                      isMobile ? "space-y-1" : "space-y-2"
                    )}>
                      {leadsInColumn.map(lead => (
                        <DraggableLeadCard
                          key={lead.id}
                          lead={lead}
                          onDelete={() => {
                            deleteLead(lead.id);
                            toast({ title: 'Lead excluído' });
                          }}
                          onConvertToClient={() => handleConvertToClient(lead.id)}
                          onRequestMove={status => handleStatusChange(lead, status)}
                          statusOptions={statusOptions}
                          activeId={activeId}
                          onScheduleClient={() => handleScheduleClient(lead)}
                          onMarkAsScheduled={() => handleMarkAsScheduled(lead.id)}
                          onViewAppointment={() => handleViewAppointment(lead)}
                          onDirectScheduling={() => handleDirectScheduling(lead)}
                        />
                      ))}
                      
                      {leadsInColumn.length === 0 && (
                        <li className={cn(
                          "text-center text-lunar-textSecondary",
                          isMobile ? "text-xs py-4" : "text-sm py-8"
                        )}>
                          Nenhum lead neste status
                        </li>
                      )}
                    </ul>
                  </DropZone>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeItem && (
              <div className="rotate-3 scale-105 opacity-80">
                <DraggableLeadCard
                  lead={activeItem}
                  onDelete={() => {}}
                  onConvertToClient={() => {}}
                  onRequestMove={() => {}}
                  statusOptions={statusOptions}
                  onScheduleClient={() => {}}
                  onMarkAsScheduled={() => {}}
                  onViewAppointment={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      <LeadFormModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen} 
        mode="create"
        onSubmit={() => {}}
      />

      <LeadSchedulingModal
        open={schedulingModalOpen}
        onOpenChange={setSchedulingModalOpen}
        lead={leadToSchedule}
        onScheduled={(appointmentId) => {
          if (leadToSchedule) {
            updateLead(leadToSchedule.id, {
              scheduledAppointmentId: appointmentId,
              needsScheduling: false
            });
          }
        }}
        onSkip={() => setSchedulingModalOpen(false)}
      />

      <SchedulingConfirmationModal
        open={!!schedulingLead}
        onOpenChange={(open) => !open && setSchedulingLead(null)}
        lead={schedulingLead}
        onScheduled={() => setSchedulingLead(null)}
        onNotScheduled={() => setSchedulingLead(null)}
      />

      <LeadLossReasonModal
        open={lossReasonModalOpen}
        onOpenChange={setLossReasonModalOpen}
        lead={leadForLossReason}
        onConfirm={(reason) => {
          if (leadForLossReason) {
            updateLead(leadForLossReason.id, {
              status: 'perdido',
              motivoPerda: reason,
              statusTimestamp: new Date().toISOString()
            });
          }
          setLossReasonModalOpen(false);
        }}
        onSkip={() => setLossReasonModalOpen(false)}
      />

      <FollowUpConfigModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
      />
    </div>
  );
}