import { useState, useEffect } from 'react';
import { format, addMonths, addWeeks, addDays, subMonths, subWeeks, subDays, addYears, subYears } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Settings, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import MonthlyView from "@/components/agenda/MonthlyView";
import WeeklyView from "@/components/agenda/WeeklyView";
import DailyView from "@/components/agenda/DailyView";
import AnnualView from "@/components/agenda/AnnualView";
import AppointmentForm from "@/components/agenda/AppointmentForm";
import AppointmentDetails from "@/components/agenda/AppointmentDetails";
import EditOrcamentoModal from "@/components/orcamentos/EditOrcamentoModal";
import BudgetAppointmentDetails from "@/components/agenda/BudgetAppointmentDetails";
import AvailabilityConfigModal from "@/components/agenda/AvailabilityConfigModal";
import { useUnifiedCalendar, UnifiedEvent } from "@/hooks/useUnifiedCalendar";
import { useAgenda, Appointment } from "@/hooks/useAgenda";
import { useIntegration } from "@/hooks/useIntegration";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/useIsTablet";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { Orcamento } from "@/types/orcamentos";
type ViewType = 'month' | 'week' | 'day' | 'year';
export default function Agenda() {
  const {
    unifiedEvents,
    getEventForSlot,
    appointments
  } = useUnifiedCalendar();
  const {
    addAppointment,
    updateAppointment,
    deleteAppointment
  } = useAgenda();
  const {
    isFromBudget,
    getBudgetId,
    canEditFully
  } = useIntegration();
  const {
    orcamentos
  } = useOrcamentos();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  
  // Transition state for smooth navigation
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Helper functions for proper date formatting
  const capitalizeFirst = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const formatWeekTitle = (date: Date): string => {
    const endOfWeek = addDays(date, 6);
    const startDay = format(date, "d", { locale: ptBR });
    const endDayMonth = format(endOfWeek, "d 'de' MMMM", { locale: ptBR });
    const monthName = format(endOfWeek, "MMMM", { locale: ptBR });
    const capitalizedMonth = capitalizeFirst(monthName);
    return `${startDay} a ${format(endOfWeek, "d")} de ${capitalizedMonth}`;
  };

  const formatDayHeaderTitle = (date: Date): string => {
    const monthName = format(date, "MMMM", { locale: ptBR });
    const capitalizedMonth = capitalizeFirst(monthName);
    return `${format(date, "d")} de ${capitalizedMonth}`;
  };

  const formatMonthTitle = (date: Date): string => {
    const monthName = format(date, "MMMM", { locale: ptBR });
    const capitalizedMonth = capitalizeFirst(monthName);
    return `${capitalizedMonth} ${format(date, "yyyy")}`;
  };

  // View and navigation state
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('preferredView') as ViewType;
    return savedView || 'month';
  });
  const [date, setDate] = useState<Date>(new Date());

  // Modal states
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isBudgetAppointmentModalOpen, setIsBudgetAppointmentModalOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);

  // Selection states
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date;
    time?: string;
  } | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<Orcamento | null>(null);
  const [selectedBudgetAppointment, setSelectedBudgetAppointment] = useState<{
    appointment: Appointment;
    budget: Orcamento | null;
  } | null>(null);

  // Save view preference
  useEffect(() => {
    localStorage.setItem('preferredView', view);
  }, [view]);

  // Format date for display
  const formatDateTitle = () => {
    switch (view) {
      case 'year':
        return format(date, "yyyy", { locale: ptBR });
      case 'month':
        return formatMonthTitle(date);
      case 'week':
        return formatWeekTitle(date);
      case 'day':
        return formatDayHeaderTitle(date);
      default:
        return '';
    }
  };

  // Format day title for daily view
  const formatDayTitle = () => {
    if (view === 'day') {
      const dayName = format(date, "EEEE", { locale: ptBR });
      return capitalizeFirst(dayName);
    }
    return '';
  };

  // Navigation functions with smooth transitions
  const navigateWithTransition = (navFunction: () => void) => {
    setIsTransitioning(true);
    setTimeout(() => {
      navFunction();
      setTimeout(() => setIsTransitioning(false), 100);
    }, 100);
  };

  // Direct navigation functions (for gestures, without transitions)
  const navigatePreviousDirect = () => {
    switch (view) {
      case 'year':
        setDate(subYears(date, 1));
        break;
      case 'month':
        setDate(subMonths(date, 1));
        break;
      case 'week':
        setDate(subWeeks(date, 1));
        break;
      case 'day':
        setDate(subDays(date, 1));
        break;
    }
  };
  
  const navigateNextDirect = () => {
    switch (view) {
      case 'year':
        setDate(addYears(date, 1));
        break;
      case 'month':
        setDate(addMonths(date, 1));
        break;
      case 'week':
        setDate(addWeeks(date, 1));
        break;
      case 'day':
        setDate(addDays(date, 1));
        break;
    }
  };
  
  // Button navigation functions (with transitions)
  const navigatePrevious = () => {
    navigateWithTransition(navigatePreviousDirect);
  };
  
  const navigateNext = () => {
    navigateWithTransition(navigateNextDirect);
  };
  
  const navigateToday = () => {
    navigateWithTransition(() => {
      setDate(new Date());
    });
  };

  // Handle day click in monthly view
  const handleDayClick = (selectedDate: Date) => {
    setDate(selectedDate);
    setView('day');
  };

  // Handle slot click (empty time slot) - directly open appointment form
  const handleCreateSlot = (slot: {
    date: Date;
    time?: string;
  }) => {
    setSelectedSlot(slot);
    setEditingAppointment(null);
    setViewingAppointment(null);
    setIsAppointmentDialogOpen(true);
    setIsDetailsOpen(false);
  };

  // Handle event click (existing appointment or budget)
  const handleEventClick = (event: UnifiedEvent) => {
    if (event.type === 'appointment') {
      const appointment = event.originalData as Appointment;
      if (isFromBudget(appointment)) {
        // Buscar o orçamento original
        const budgetId = getBudgetId(appointment);
        const originalBudget = orcamentos.find(orc => orc.id === budgetId);
        setSelectedBudgetAppointment({
          appointment,
          budget: originalBudget || null
        });
        setIsBudgetAppointmentModalOpen(true);

        // Limpar outros estados
        setEditingAppointment(null);
        setViewingAppointment(null);
        setSelectedSlot(null);
        setIsAppointmentDialogOpen(false);
        setIsDetailsOpen(false);
      } else {
        setViewingAppointment(appointment);
        setEditingAppointment(null);
        setSelectedSlot(null);
        setIsAppointmentDialogOpen(false);
        setIsDetailsOpen(true);
      }
    } else if (event.type === 'budget') {
      const budget = event.originalData as Orcamento;
      setSelectedBudget(budget);
      setIsBudgetModalOpen(true);
    }
  };

  // Handle appointment save
  const handleSaveAppointment = (appointmentData: any) => {
    if (editingAppointment) {
      updateAppointment(editingAppointment.id, appointmentData);
      toast.success("Agendamento atualizado com sucesso");
    } else if (viewingAppointment) {
      updateAppointment(viewingAppointment.id, appointmentData);
      setIsDetailsOpen(false);
    } else {
      addAppointment(appointmentData);
      toast.success("Novo agendamento criado");
    }
    setIsAppointmentDialogOpen(false);
  };

  // Handle appointment deletion
  const handleDeleteAppointment = (id: string) => {
    deleteAppointment(id);
    setIsDetailsOpen(false);
    setIsBudgetAppointmentModalOpen(false);
    toast.success("Agendamento excluído com sucesso");
  };

  // Handle budget appointment save (reschedule)
  const handleSaveBudgetAppointment = (data: {
    date: Date;
    time: string;
    description?: string;
  }) => {
    if (selectedBudgetAppointment) {
      updateAppointment(selectedBudgetAppointment.appointment.id, {
        date: data.date,
        time: data.time,
        description: data.description
      });
      setIsBudgetAppointmentModalOpen(false);
    }
  };

  // Swipe navigation for mobile and tablet (using direct functions, no transitions)
  const swipeHandlers = useSwipeNavigation({
    enabled: (isMobile || isTablet) && view !== 'year',
    onPrev: navigatePreviousDirect,
    onNext: navigateNextDirect,
    thresholdPx: 25,
    maxVerticalRatio: 0.8
  });

  // Debug logs
  console.log('📱 Device detection:', { isMobile, isTablet, view, swipeEnabled: (isMobile || isTablet) && view !== 'year' });

  // Handle view full budget from appointment modal
  const handleViewFullBudget = () => {
    if (selectedBudgetAppointment?.budget) {
      setIsBudgetAppointmentModalOpen(false);
      setSelectedBudget(selectedBudgetAppointment.budget);
      setIsBudgetModalOpen(true);
    }
  };
  return <div className="w-full max-w-7xl mx-auto px-2 md:px-4 lg:px-6 space-y-2 md:space-y-4 pb-20 md:pb-4">
      <Card className="p-2 md:p-4 bg-lunar-bg mx-0">
        <div className="flex flex-col items-center justify-center mb-2 md:mb-4 gap-2 md:gap-3">
          {/* Mobile Layout (unchanged) */}
          {isMobile && <>
              {/* Navigation and Date Display */}
              <div className="flex items-center justify-between w-full gap-1">
                <Button variant="outline" onClick={navigateToday} className="h-8 px-2 text-xs bg-lunar-surface hover:bg-lunar-border border-lunar-border">
                  Hoje
                </Button>
                
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={navigatePrevious} aria-label="Período anterior" className="bg-lunar-surface hover:bg-lunar-border border-lunar-border h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="text-sm font-medium min-w-[150px] text-center px-2">
                    {formatDateTitle()}
                  </div>
                  
                  <Button variant="outline" size="icon" onClick={navigateNext} aria-label="Próximo período" className="bg-lunar-surface hover:bg-lunar-border border-lunar-border h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Mobile View Toggle Buttons */}
              <div className="flex items-center gap-2 w-full">
                <div className="flex bg-lunar-surface border border-lunar-border rounded-lg p-1 flex-1">
                  <Button variant={view === 'day' ? "default" : "ghost"} size="sm" onClick={() => setView('day')} className={`flex-1 ${view === 'day' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}`}>
                    Dia
                  </Button>
                  <Button variant={view === 'week' ? "default" : "ghost"} size="sm" onClick={() => setView('week')} className={`flex-1 ${view === 'week' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}`}>
                    Semana
                  </Button>
                  <Button variant={view === 'month' ? "default" : "ghost"} size="sm" onClick={() => setView('month')} className={`flex-1 ${view === 'month' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}`}>
                    Mês
                  </Button>
                  <Button variant={view === 'year' ? "default" : "ghost"} size="sm" onClick={() => setView('year')} className={`flex-1 ${view === 'year' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}`}>
                    Ano
                  </Button>
                </div>
                
                {/* Mobile Manage Schedules Button - Only icon */}
                <Button variant="outline" size="icon" onClick={() => setIsAvailabilityModalOpen(true)} className="bg-lunar-surface hover:bg-lunar-border border-lunar-border h-8 w-8" title="Gerenciar Horários">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </>}

          {/* Tablet Layout */}
          {isTablet && <>
              {/* First Line: Navigation and Date */}
              <div className="flex items-center justify-center w-full gap-4">
                <Button variant="outline" onClick={navigateToday} className="h-8 px-3 text-sm bg-lunar-surface hover:bg-lunar-border border-lunar-border">
                  Hoje
                </Button>
                
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={navigatePrevious} aria-label="Período anterior" className="bg-lunar-surface hover:bg-lunar-border border-lunar-border h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="text-base font-medium min-w-[250px] text-center px-2">
                    {formatDateTitle()}
                  </div>
                  
                  <Button variant="outline" size="icon" onClick={navigateNext} aria-label="Próximo período" className="bg-lunar-surface hover:bg-lunar-border border-lunar-border h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Second Line: View Toggles and Manage Button */}
              <div className="flex items-center justify-center w-full gap-4">
                <div className="bg-lunar-surface border border-lunar-border rounded-lg p-1 py-0">
                  <Button variant={view === 'day' ? "default" : "ghost"} size="sm" onClick={() => setView('day')} className={view === 'day' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}>
                    Dia
                  </Button>
                  <Button variant={view === 'week' ? "default" : "ghost"} size="sm" onClick={() => setView('week')} className={view === 'week' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}>
                    Semana
                  </Button>
                  <Button variant={view === 'month' ? "default" : "ghost"} size="sm" onClick={() => setView('month')} className={view === 'month' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}>
                    Mês
                  </Button>
                  <Button variant={view === 'year' ? "default" : "ghost"} size="sm" onClick={() => setView('year')} className={view === 'year' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}>
                    Ano
                  </Button>
                </div>
                
                <Button variant="outline" onClick={() => setIsAvailabilityModalOpen(true)} className="bg-lunar-surface hover:bg-lunar-border border-lunar-border h-6 px-3 py-0 my-0 text-xs">
                  <Settings className="h-4 w-4 mr-2" />
                  Gerenciar Horários
                </Button>
              </div>
            </>}

          {/* Desktop Layout */}
          {!isMobile && !isTablet && <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={navigateToday} className="h-8 px-3 text-sm bg-lunar-surface hover:bg-lunar-border border-lunar-border">
                  Hoje
                </Button>
                
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={navigatePrevious} aria-label="Período anterior" className="bg-lunar-surface hover:bg-lunar-border border-lunar-border h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="text-base font-medium min-w-[200px] text-center px-2">
                    {formatDateTitle()}
                  </div>
                  
                  <Button variant="outline" size="icon" onClick={navigateNext} aria-label="Próximo período" className="bg-lunar-surface hover:bg-lunar-border border-lunar-border h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="bg-lunar-surface border border-lunar-border rounded-lg p-1">
                  <Button variant={view === 'day' ? "default" : "ghost"} size="sm" onClick={() => setView('day')} className={view === 'day' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}>
                    Dia
                  </Button>
                  <Button variant={view === 'week' ? "default" : "ghost"} size="sm" onClick={() => setView('week')} className={view === 'week' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}>
                    Semana
                  </Button>
                  <Button variant={view === 'month' ? "default" : "ghost"} size="sm" onClick={() => setView('month')} className={view === 'month' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}>
                    Mês
                  </Button>
                  <Button variant={view === 'year' ? "default" : "ghost"} size="sm" onClick={() => setView('year')} className={view === 'year' ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"}>
                    Ano
                  </Button>
                </div>
              </div>

              {/* Manage Schedules Button - Far Right */}
              <Button variant="outline" onClick={() => setIsAvailabilityModalOpen(true)} className="bg-lunar-surface hover:bg-lunar-border border-lunar-border h-8 px-3 text-sm">
                <Settings className="h-4 w-4 mr-2" />
                Gerenciar Horários
              </Button>
            </div>}

          {/* Day Title for Daily View */}
          {view === 'day' && formatDayTitle() && <div className="text-lg font-medium text-lunar-textSecondary">
              {formatDayTitle()}
            </div>}
        </div>
          
        <div 
          className={`mt-4 touch-pan-y select-none sm:select-auto transition-all duration-200 ease-out ${
            isTransitioning ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
          }`}
          {...((isMobile || isTablet) && view !== 'year' ? swipeHandlers : {})}
        >
          {view === 'year' && <AnnualView date={date} unifiedEvents={unifiedEvents} onDayClick={handleDayClick} onEventClick={handleEventClick} />}
          {view === 'month' && <MonthlyView date={date} unifiedEvents={unifiedEvents} onCreateSlot={handleCreateSlot} onEventClick={handleEventClick} onDayClick={handleDayClick} />}
          {view === 'week' && <WeeklyView date={date} unifiedEvents={unifiedEvents} onCreateSlot={handleCreateSlot} onEventClick={handleEventClick} />}
          {view === 'day' && <DailyView date={date} unifiedEvents={unifiedEvents} onCreateSlot={handleCreateSlot} onEventClick={handleEventClick} />}
        </div>
      </Card>


      {/* Appointment Form Modal */}
      <Dialog open={isAppointmentDialogOpen} onOpenChange={setIsAppointmentDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Complete os detalhes do agendamento abaixo.
            </DialogDescription>
          </DialogHeader>

          <AppointmentForm initialDate={selectedSlot?.date || editingAppointment?.date} initialTime={selectedSlot?.time || editingAppointment?.time} appointment={editingAppointment} onSave={handleSaveAppointment} onCancel={() => setIsAppointmentDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Appointment Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background border-border">
          {viewingAppointment && <AppointmentDetails appointment={viewingAppointment} onSave={handleSaveAppointment} onCancel={() => setIsDetailsOpen(false)} onDelete={handleDeleteAppointment} />}
        </DialogContent>
      </Dialog>

      {/* Budget Appointment Details Modal */}
      <Dialog open={isBudgetAppointmentModalOpen} onOpenChange={setIsBudgetAppointmentModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-background border-border">
          {selectedBudgetAppointment && <BudgetAppointmentDetails appointment={selectedBudgetAppointment.appointment} budget={selectedBudgetAppointment.budget} onSave={handleSaveBudgetAppointment} onCancel={() => setIsBudgetAppointmentModalOpen(false)} onViewFullBudget={handleViewFullBudget} onDelete={handleDeleteAppointment} />}
        </DialogContent>
      </Dialog>

      {/* Budget Edit Modal */}
      <EditOrcamentoModal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} orcamento={selectedBudget} />

      {/* Availability Config Modal */}
      <AvailabilityConfigModal isOpen={isAvailabilityModalOpen} onClose={() => setIsAvailabilityModalOpen(false)} date={selectedSlot?.date || new Date()} initialTime={selectedSlot?.time} />
    </div>;
}