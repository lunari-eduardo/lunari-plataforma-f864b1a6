import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import MonthlyView from "@/components/agenda/MonthlyView";
import WeeklyView from "@/components/agenda/WeeklyView";
import DailyView from "@/components/agenda/DailyView";
import AnnualView from "@/components/agenda/AnnualView";
import AgendaHeader from "@/components/agenda/AgendaHeader";
import AgendaModals from "@/components/agenda/AgendaModals";
import AgendaTasksSection from "@/components/agenda/AgendaTasksSection";
import UnifiedTaskModal from "@/components/tarefas/UnifiedTaskModal";
import { useUnifiedCalendar, UnifiedEvent } from "@/hooks/useUnifiedCalendar";
import { useAgenda, Appointment } from "@/hooks/useAgenda";
import { useAvailability } from "@/hooks/useAvailability";
import { useIntegration } from "@/hooks/useIntegration";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useAgendaNavigation } from "@/hooks/useAgendaNavigation";
import { useAgendaModals } from "@/hooks/useAgendaModals";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { DataIntegrityPanel } from "@/components/agenda/DataIntegrityPanel";
import { Orcamento } from '@/types/orcamento';
import { useAgendaConflict } from '@/hooks/useAgendaConflict';
import { SlotConflictDialog } from '@/components/agenda/SlotConflictDialog';
import AgendaSidebar from '@/components/agenda/AgendaSidebar';
import { useAgendaKeyboardShortcuts } from '@/hooks/useAgendaKeyboardShortcuts';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CalendarDays } from 'lucide-react';


export default function Agenda() {
  const { unifiedEvents } = useUnifiedCalendar();
  const { addAppointment, updateAppointment, deleteAppointment, loadMonthData } = useAgenda();
  const { availability } = useAvailability();
  const { isFromBudget, getBudgetId } = useIntegration();
  const { orcamentos } = useOrcamentos();
  const { tasks, addTask } = useSupabaseTasks();
  const { isMobile, isTablet, classes } = useResponsiveLayout();
  
  // Task modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  // Navigation hook
  const {
    view,
    date,
    setView,
    navigatePrevious,
    navigateNext,
    navigateToday,
    navigateToDate
  } = useAgendaNavigation();

  // Auto-load month data when navigating
  useEffect(() => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    if (view === 'year') {
      for (let m = 0; m < 12; m++) {
        loadMonthData(year, m);
      }
    } else if (view === 'week') {
      loadMonthData(year, month);
      if (date.getDate() > 24) loadMonthData(month === 11 ? year + 1 : year, (month + 1) % 12);
      if (date.getDate() < 7) loadMonthData(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
    } else {
      loadMonthData(year, month);
    }
  }, [date, view, loadMonthData]);
  
  // Modal management hook
  const {
    isAppointmentDialogOpen,
    isDetailsOpen,
    isBudgetModalOpen,
    isBudgetAppointmentModalOpen,
    isAvailabilityModalOpen,
    isShareModalOpen,
    selectedSlot,
    editingAppointment,
    viewingAppointment,
    selectedBudget,
    selectedBudgetAppointment,
    openAppointmentDialog,
    openAppointmentDetails,
    openBudgetModal,
    openBudgetAppointmentModal,
    openAvailabilityModal,
    openShareModal,
    handleViewFullBudget,
    setIsAppointmentDialogOpen,
    setIsDetailsOpen,
    setIsBudgetModalOpen,
    setIsBudgetAppointmentModalOpen,
    setIsAvailabilityModalOpen,
    setIsShareModalOpen
  } = useAgendaModals();

  // Navigation functions (simplified)
  const handleNavigatePrevious = useCallback(() => {
    navigatePrevious();
  }, [navigatePrevious]);

  const handleNavigateNext = useCallback(() => {
    navigateNext();
  }, [navigateNext]);

  const handleNavigateToday = useCallback(() => {
    navigateToday();
  }, [navigateToday]);

  // Handle day click in monthly view
  const handleDayClick = useCallback((selectedDate: Date) => {
    setView('day');
    // Navigate directly to selected date
    navigateToDate(selectedDate);
  }, [setView, navigateToDate]);

  // Handle month click in annual view
  const handleMonthClick = useCallback((selectedDate: Date) => {
    setView('month');
    navigateToDate(selectedDate);
  }, [setView, navigateToDate]);

  // Handle slot click (empty time slot) - directly open appointment form
  const handleCreateSlot = useCallback((slot: { date: Date; time?: string }) => {
    openAppointmentDialog(slot);
  }, [openAppointmentDialog]);

  // Handle event click (existing appointment or budget)
  const handleEventClick = useCallback((event: UnifiedEvent) => {
    if (event.type === 'appointment') {
      const appointment = event.originalData as Appointment;
      if (isFromBudget(appointment)) {
        // Buscar o orçamento original
        const budgetId = getBudgetId(appointment);
        const originalBudget = orcamentos.find(orc => orc.id === budgetId);
        openBudgetAppointmentModal(appointment, originalBudget || null);
      } else {
        openAppointmentDetails(appointment);
      }
    } else if (event.type === 'budget') {
      const budget = event.originalData as Orcamento;
      openBudgetModal(budget);
    }
  }, [isFromBudget, getBudgetId, orcamentos, openBudgetAppointmentModal, openAppointmentDetails, openBudgetModal]);

  // Controller centralizado de conflitos (busy/blocked/pending)
  const { guard: conflictGuard, dialogProps: conflictDialogProps } = useAgendaConflict();

  // Handle appointment save (sem guard: o AppointmentDetails/AppointmentForm já validam via useAgendaConflict local)
  const handleSaveAppointment = useCallback(async (appointmentData: any) => {
    if (editingAppointment) {
      await updateAppointment(editingAppointment.id, appointmentData);
      setIsAppointmentDialogOpen(false);
    } else if (viewingAppointment) {
      await updateAppointment(viewingAppointment.id, appointmentData);
      setIsDetailsOpen(false);
    } else {
      await addAppointment(appointmentData);
      setIsAppointmentDialogOpen(false);
    }
  }, [editingAppointment, viewingAppointment, updateAppointment, addAppointment, setIsDetailsOpen, setIsAppointmentDialogOpen]);

  // Persistência silenciosa (NÃO fecha o modal) — usada antes da cobrança em AppointmentDetails
  const handlePersistAppointment = useCallback(async (appointmentData: any) => {
    const id = editingAppointment?.id ?? viewingAppointment?.id;
    if (!id) return;
    await updateAppointment(id, appointmentData);
  }, [editingAppointment, viewingAppointment, updateAppointment]);

  // Handle appointment deletion
  const handleDeleteAppointment = useCallback(async (id: string, action?: 'preserve' | 'refund' | 'remove') => {
    try {
      await deleteAppointment(id, action);
      
      switch (action) {
        case 'preserve':
          toast.success('Agendamento cancelado com sucesso! Histórico de pagamentos preservado.');
          break;
        case 'refund':
          toast.success('Pagamentos estornados e agendamento excluído com sucesso.');
          break;
        case 'remove':
        default:
          toast.success('Agendamento e todos os dados relacionados foram excluídos permanentemente.');
          break;
      }
      
      setIsDetailsOpen(false);
      setIsBudgetAppointmentModalOpen(false);
    } catch (error: any) {
      console.error('❌ Erro ao deletar agendamento:', error);
      toast.error(`Erro ao excluir: ${error.message || 'Erro desconhecido'}`);
      throw error;
    }
  }, [deleteAppointment, setIsDetailsOpen, setIsBudgetAppointmentModalOpen]);

  // Handle budget appointment save (reschedule)
  const handleSaveBudgetAppointment = useCallback(async (data: {
    date: Date;
    time: string;
    description?: string;
  }) => {
    if (!selectedBudgetAppointment) return;
    const apt = selectedBudgetAppointment.appointment;
    await conflictGuard({
      date: data.date,
      time: data.time,
      status: apt.status,
      ignoreAppointmentId: apt.id,
      silentOnPending: apt.status !== 'confirmado',
      exec: async () => {
        await updateAppointment(apt.id, {
          date: data.date,
          time: data.time,
          description: data.description,
        });
        setIsBudgetAppointmentModalOpen(false);
      },
    });
  }, [selectedBudgetAppointment, updateAppointment, setIsBudgetAppointmentModalOpen, conflictGuard]);

  // Swipe navigation for mobile and tablet
  const swipeHandlers = useSwipeNavigation({
    enabled: (isMobile || isTablet) && view !== 'year',
    onPrev: navigatePrevious,
    onNext: navigateNext,
    thresholdPx: 38,
    maxVerticalRatio: 0.8
  });

  const renderView = () => {
    const commonProps = {
      date,
      unifiedEvents,
      onCreateSlot: handleCreateSlot,
      onEventClick: handleEventClick
    };

    switch (view) {
      case 'year':
        return (
          <AnnualView
            date={date}
            unifiedEvents={unifiedEvents}
            availability={availability}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
            onMonthClick={handleMonthClick}
          />
        );
      case 'month':
        return (
          <MonthlyView
            {...commonProps}
            onDayClick={handleDayClick}
          />
        );
      case 'week':
        return (
          <WeeklyView
            {...commonProps}
            onDayClick={handleDayClick}
          />
        );
      case 'day':
        return (
          <DailyView {...commonProps} onOpenAvailability={openAvailabilityModal} />
        );
      default:
        return null;
    }
  };

  useAgendaKeyboardShortcuts({
    onPrev: handleNavigatePrevious,
    onNext: handleNavigateNext,
    onToday: handleNavigateToday,
    onViewChange: setView,
  });

  const showSidebar = !isMobile && !isTablet && view !== 'year';
  const isYearView = view === 'year';

  return (
    <div className={`w-full ${isYearView ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto ${classes.container} pb-20 md:pb-4`}>
      <Card className={`${classes.card} bg-card/30 backdrop-blur-xl dark:bg-card/[0.04] border-white/50 dark:border-white/10 mx-0`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <AgendaHeader
              view={view}
              date={date}
              onViewChange={setView}
              onNavigatePrevious={handleNavigatePrevious}
              onNavigateNext={handleNavigateNext}
              onNavigateToday={handleNavigateToday}
              onOpenAvailability={openAvailabilityModal}
              onOpenShare={view === 'day' ? openShareModal : undefined}
            />
          </div>
          {!showSidebar && !isYearView && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" aria-label="Abrir mini calendário">
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] sm:w-[360px] overflow-y-auto">
                <div className="pt-6">
                  <AgendaSidebar
                    date={date}
                    view={view}
                    unifiedEvents={unifiedEvents}
                    onNavigateToDate={navigateToDate}
                    onSwitchToDay={() => setView('day')}
                  />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>

        <div className={showSidebar ? 'mt-4 grid grid-cols-[260px_1fr] gap-4' : 'mt-4'}>
          {showSidebar && (
            <AgendaSidebar
              date={date}
              view={view}
              unifiedEvents={unifiedEvents}
              onNavigateToDate={navigateToDate}
              onSwitchToDay={() => setView('day')}
            />
          )}
          <div className="min-w-0">
            <div {...(isMobile || isTablet) && view !== 'year' ? swipeHandlers : {}}>
              {renderView()}
            </div>

            <AgendaTasksSection
              selectedDate={date}
              tasks={tasks}
              viewMode={view}
              onCreateTask={() => setIsTaskModalOpen(true)}
              onDayClick={handleDayClick}
            />

            <div className="mt-4">
              <DataIntegrityPanel />
            </div>
          </div>
        </div>
      </Card>


      {/* Task creation modal */}
      <UnifiedTaskModal
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        mode="create"
        initial={{ dueDate: format(date, 'yyyy-MM-dd') }}
        onSubmit={async (data) => {
          await addTask({ ...data, source: 'manual' });
          setIsTaskModalOpen(false);
          toast.success('Tarefa criada com sucesso');
        }}
      />

      <AgendaModals
        // Modal states
        isAppointmentDialogOpen={isAppointmentDialogOpen}
        isDetailsOpen={isDetailsOpen}
        isBudgetModalOpen={isBudgetModalOpen}
        isBudgetAppointmentModalOpen={isBudgetAppointmentModalOpen}
        isAvailabilityModalOpen={isAvailabilityModalOpen}
        isShareModalOpen={isShareModalOpen}
        
        // Selection states
        selectedSlot={selectedSlot}
        editingAppointment={editingAppointment}
        viewingAppointment={viewingAppointment}
        selectedBudget={selectedBudget}
        selectedBudgetAppointment={selectedBudgetAppointment}
        
        // Modal setters
        setIsAppointmentDialogOpen={setIsAppointmentDialogOpen}
        setIsDetailsOpen={setIsDetailsOpen}
        setIsBudgetModalOpen={setIsBudgetModalOpen}
        setIsBudgetAppointmentModalOpen={setIsBudgetAppointmentModalOpen}
        setIsAvailabilityModalOpen={setIsAvailabilityModalOpen}
        setIsShareModalOpen={setIsShareModalOpen}
        
        // Event handlers
        onSaveAppointment={handleSaveAppointment}
        onAutoSaveAppointment={handleAutoSaveAppointment}
        onDeleteAppointment={handleDeleteAppointment}
        onSaveBudgetAppointment={handleSaveBudgetAppointment}
        onViewFullBudget={handleViewFullBudget}
      />
      <SlotConflictDialog {...conflictDialogProps} />
    </div>
  );
}