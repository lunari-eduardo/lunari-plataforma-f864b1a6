import { useState, useCallback } from 'react';
import { Appointment } from '@/hooks/useAgenda';
import { Orcamento } from '@/types/orcamento';

export interface SelectedSlot {
  date: Date;
  time?: string;
}

export interface SelectedBudgetAppointment {
  appointment: Appointment;
  budget: Orcamento | null;
}

export const useAgendaModals = () => {
  // Modal states
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isBudgetAppointmentModalOpen, setIsBudgetAppointmentModalOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Selection states
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<Orcamento | null>(null);
  const [selectedBudgetAppointment, setSelectedBudgetAppointment] = useState<SelectedBudgetAppointment | null>(null);

  // Modal actions - using useCallback for performance
  const openAppointmentDialog = useCallback((slot?: SelectedSlot, appointment?: Appointment) => {
    setSelectedSlot(slot || null);
    setEditingAppointment(appointment || null);
    setViewingAppointment(null);
    setIsAppointmentDialogOpen(true);
    // Close other modals
    setIsDetailsOpen(false);
    setIsBudgetModalOpen(false);
    setIsBudgetAppointmentModalOpen(false);
  }, []);

  const openAppointmentDetails = useCallback((appointment: Appointment) => {
    setViewingAppointment(appointment);
    setEditingAppointment(null);
    setSelectedSlot(null);
    setIsDetailsOpen(true);
    // Close other modals
    setIsAppointmentDialogOpen(false);
    setIsBudgetModalOpen(false);
    setIsBudgetAppointmentModalOpen(false);
  }, []);

  const openBudgetModal = useCallback((budget: Orcamento) => {
    setSelectedBudget(budget);
    setIsBudgetModalOpen(true);
    // Close other modals
    setIsAppointmentDialogOpen(false);
    setIsDetailsOpen(false);
    setIsBudgetAppointmentModalOpen(false);
  }, []);

  const openBudgetAppointmentModal = useCallback((appointment: Appointment, budget: Orcamento | null) => {
    setSelectedBudgetAppointment({ appointment, budget });
    setIsBudgetAppointmentModalOpen(true);
    // Close other modals
    setIsAppointmentDialogOpen(false);
    setIsDetailsOpen(false);
    setIsBudgetModalOpen(false);
  }, []);

  const openAvailabilityModal = useCallback((date?: Date, time?: string) => {
    if (date || time) {
      setSelectedSlot({ date: date || new Date(), time });
    }
    setIsAvailabilityModalOpen(true);
  }, []);

  const openShareModal = useCallback(() => {
    setIsShareModalOpen(true);
  }, []);

  const closeAllModals = useCallback(() => {
    setIsAppointmentDialogOpen(false);
    setIsDetailsOpen(false);
    setIsBudgetModalOpen(false);
    setIsBudgetAppointmentModalOpen(false);
    setIsAvailabilityModalOpen(false);
    setIsShareModalOpen(false);
    
    // Clear selections
    setSelectedSlot(null);
    setEditingAppointment(null);
    setViewingAppointment(null);
    setSelectedBudget(null);
    setSelectedBudgetAppointment(null);
  }, []);

  const handleViewFullBudget = useCallback(() => {
    if (selectedBudgetAppointment?.budget) {
      setIsBudgetAppointmentModalOpen(false);
      setSelectedBudget(selectedBudgetAppointment.budget);
      setIsBudgetModalOpen(true);
    }
  }, [selectedBudgetAppointment]);

  return {
    // Modal states
    isAppointmentDialogOpen,
    isDetailsOpen,
    isBudgetModalOpen,
    isBudgetAppointmentModalOpen,
    isAvailabilityModalOpen,
    isShareModalOpen,
    
    // Selection states
    selectedSlot,
    editingAppointment,
    viewingAppointment,
    selectedBudget,
    selectedBudgetAppointment,
    
    // Modal actions
    openAppointmentDialog,
    openAppointmentDetails,
    openBudgetModal,
    openBudgetAppointmentModal,
    openAvailabilityModal,
    openShareModal,
    closeAllModals,
    handleViewFullBudget,
    
    // Direct setters for simple cases
    setIsAppointmentDialogOpen,
    setIsDetailsOpen,
    setIsBudgetModalOpen,
    setIsBudgetAppointmentModalOpen,
    setIsAvailabilityModalOpen,
    setIsShareModalOpen
  };
};