import { useState, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import MonthlyView from "@/components/agenda/MonthlyView";
import WeeklyView from "@/components/agenda/WeeklyView";
import DailyView from "@/components/agenda/DailyView";
import AnnualView from "@/components/agenda/AnnualView";
import AgendaHeader from "@/components/agenda/AgendaHeader";
import AgendaModals from "@/components/agenda/AgendaModals";
import { useUnifiedCalendar, UnifiedEvent } from "@/hooks/useUnifiedCalendar";
import { useAgenda, Appointment } from "@/hooks/useAgenda";
import { useIntegration } from "@/hooks/useIntegration";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useAgendaNavigation } from "@/hooks/useAgendaNavigation";
import { useAgendaModals } from "@/hooks/useAgendaModals";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { Orcamento } from "@/types/orcamentos";

export default function Agenda() {
  const { unifiedEvents } = useUnifiedCalendar();
  const { addAppointment, updateAppointment, deleteAppointment } = useAgenda();
  const { isFromBudget, getBudgetId } = useIntegration();
  const { orcamentos } = useOrcamentos();
  const { isMobile, isTablet, classes } = useResponsiveLayout();
  
  // Navigation hook
  const {
    view,
    date,
    setView,
    navigatePrevious,
    navigateNext,
    navigateToday
  } = useAgendaNavigation();
  
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
    navigateToday();
  }, [setView, navigateToday]);

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

  // Handle appointment save
  const handleSaveAppointment = useCallback((appointmentData: any) => {
    try {
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
    } catch (error: any) {
      if (error.message.includes('agendamento confirmado neste horário')) {
        toast.error('Não é possível criar agendamento: já existe um agendamento confirmado neste horário.');
      } else {
        toast.error('Erro ao salvar agendamento: ' + error.message);
      }
      // Não fechar o modal para permitir correção
    }
  }, [editingAppointment, viewingAppointment, updateAppointment, addAppointment, setIsDetailsOpen, setIsAppointmentDialogOpen]);

  // Handle appointment deletion
  const handleDeleteAppointment = useCallback((id: string, preservePayments?: boolean) => {
    deleteAppointment(id, preservePayments);
    setIsDetailsOpen(false);
    setIsBudgetAppointmentModalOpen(false);
  }, [deleteAppointment, setIsDetailsOpen, setIsBudgetAppointmentModalOpen]);

  // Handle budget appointment save (reschedule)
  const handleSaveBudgetAppointment = useCallback((data: {
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
  }, [selectedBudgetAppointment, updateAppointment, setIsBudgetAppointmentModalOpen]);

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
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
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
          <DailyView {...commonProps} />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`w-full max-w-7xl mx-auto ${classes.container} pb-20 md:pb-4`}>
      <Card className={`${classes.card} bg-lunar-bg mx-0`}>
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
          
        {/* Content container with swipe support */}
        <div className="mt-4" {...(isMobile || isTablet) && view !== 'year' ? swipeHandlers : {}}>
          {renderView()}
        </div>
      </Card>

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
        onDeleteAppointment={handleDeleteAppointment}
        onSaveBudgetAppointment={handleSaveBudgetAppointment}
        onViewFullBudget={handleViewFullBudget}
      />
    </div>
  );
}