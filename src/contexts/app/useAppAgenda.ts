import { useState, useEffect, useCallback } from "react";
import { storage, STORAGE_KEYS } from "@/utils/localStorage";
import type { Appointment } from "@/modules/agenda/presentation";
import type { AvailabilitySlot, AvailabilityType } from "@/types/availability";

export function useAppAgenda() {
  // MIGRATED TO SUPABASE: Usar useAgendaRealtime() para appointments
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // MIGRATED TO SUPABASE: Usar useAgendaRealtime() para availability
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);

  // Tipos de Disponibilidade
  const [availabilityTypes, setAvailabilityTypes] = useState<AvailabilityType[]>(() => {
    const defaultTypes: AvailabilityType[] = [
      { id: "default", name: "Disponível", color: "#10b981" },
    ];
    return storage.load(STORAGE_KEYS.AVAILABILITY_TYPES, defaultTypes);
  });

  // Migração: Atualizar tipo "Padrão" para "Disponível"
  useEffect(() => {
    const needsMigration = availabilityTypes.some(
      (type) => type.id === "default" && type.name === "Padrão",
    );

    if (needsMigration) {
      setAvailabilityTypes((prev) =>
        prev.map((type) =>
          type.id === "default" && type.name === "Padrão"
            ? { ...type, name: "Disponível" }
            : type,
        ),
      );
    }
  }, [availabilityTypes]);

  // Cliente pré-selecionado State
  const [selectedClientForScheduling, setSelectedClientForScheduling] = useState<string | null>(
    null,
  );

  const clearSelectedClientForScheduling = useCallback(() => {
    setSelectedClientForScheduling(null);
  }, []);

  // Utility functions
  const isFromBudget = useCallback((appointment: Appointment) => {
    return (
      appointment.id?.startsWith("orcamento-") || (appointment as any).origem === "orcamento"
    );
  }, []);

  const getBudgetId = useCallback((appointment: Appointment) => {
    if (appointment.id?.startsWith("orcamento-")) {
      return appointment.id.replace("orcamento-", "");
    }
    return (appointment as any).orcamentoId;
  }, []);

  const canEditFully = useCallback(
    (appointment: Appointment) => {
      return !(
        appointment.id?.startsWith("orcamento-") || (appointment as any).origem === "orcamento"
      );
    },
    [],
  );

  // Agenda Actions
  const addAppointment = useCallback((appointment: Omit<Appointment, "id">) => {
    const newAppointment: Appointment = {
      ...appointment,
      id: Date.now().toString(),
    };

    setAppointments((prev) => [...prev, newAppointment]);
    return newAppointment;
  }, []);

  const updateAppointment = useCallback(
    (id: string, appointment: Partial<Appointment>) => {
      setAppointments((prev) => {
        const updatedAppointments = prev.map((app) =>
          app.id === id ? { ...app, ...appointment } : app,
        );

        return updatedAppointments;
      });
    },
    [],
  );

  const deleteAppointment = useCallback((id: string, _preservePayments?: boolean) => {
    setAppointments((prev) => prev.filter((app) => app.id !== id));
  }, []);

  // Availability actions
  const addAvailabilitySlots = useCallback((slots: AvailabilitySlot[]) => {
    setAvailability((prev) => [...prev, ...slots]);
  }, []);

  const clearAvailabilityForDate = useCallback((date: string) => {
    setAvailability((prev) => prev.filter((slot) => slot.date !== date));
  }, []);

  const deleteAvailabilitySlot = useCallback((id: string) => {
    setAvailability((prev) => prev.filter((slot) => slot.id !== id));
  }, []);

  // Availability type actions
  const addAvailabilityType = useCallback((input: { name: string; color: string }) => {
    const newType: AvailabilityType = {
      id: Date.now().toString(),
      ...input,
    };
    setAvailabilityTypes((prev) => [...prev, newType]);
    return newType;
  }, []);

  const updateAvailabilityType = useCallback(
    (id: string, updates: Partial<AvailabilityType>) => {
      setAvailabilityTypes((prev) =>
        prev.map((type) => (type.id === id ? { ...type, ...updates } : type)),
      );
    },
    [],
  );

  const deleteAvailabilityType = useCallback((id: string) => {
    setAvailabilityTypes((prev) => prev.filter((type) => type.id !== id));
  }, []);

  return {
    appointments,
    availability,
    availabilityTypes,
    selectedClientForScheduling,
    setSelectedClientForScheduling,
    clearSelectedClientForScheduling,
    isFromBudget,
    getBudgetId,
    canEditFully,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    addAvailabilitySlots,
    clearAvailabilityForDate,
    deleteAvailabilitySlot,
    addAvailabilityType,
    updateAvailabilityType,
    deleteAvailabilityType,
  };
}
