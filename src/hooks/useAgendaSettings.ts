// Hook para gerenciamento de configurações da agenda
import { useCallback } from 'react';
import { useAgendaContext } from '@/contexts/AgendaContext';
import { AgendaSettings } from '@/types/agenda-supabase';

export const useAgendaSettings = () => {
  const { agendaSettings, updateAgendaSettings } = useAgendaContext();

  // Atualizar view preferida (migrado de useAgendaNavigation)
  const updatePreferredView = useCallback(async (view: 'year' | 'month' | 'week' | 'day') => {
    await updateAgendaSettings({ preferredView: view });
  }, [updateAgendaSettings]);

  // Atualizar slots de horários
  const updateTimeSlots = useCallback(async (timeSlots: string[]) => {
    await updateAgendaSettings({ timeSlots });
  }, [updateAgendaSettings]);

  // Atualizar dias de trabalho
  const updateWorkingDays = useCallback(async (workingDays: number[]) => {
    await updateAgendaSettings({ workingDays });
  }, [updateAgendaSettings]);

  // Atualizar horário de trabalho
  const updateWorkingHours = useCallback(async (workingHours: { start: string; end: string }) => {
    await updateAgendaSettings({ workingHours });
  }, [updateAgendaSettings]);

  // Atualizar resolução de conflitos
  const updateConflictResolution = useCallback(async (conflictResolution: 'allow' | 'warn' | 'block') => {
    await updateAgendaSettings({ conflictResolution });
  }, [updateAgendaSettings]);

  // Helpers
  const isWorkingDay = useCallback((dayOfWeek: number) => {
    return agendaSettings.workingDays.includes(dayOfWeek);
  }, [agendaSettings.workingDays]);

  const isWorkingTime = useCallback((time: string) => {
    const { start, end } = agendaSettings.workingHours;
    return time >= start && time <= end;
  }, [agendaSettings.workingHours]);

  const getAvailableTimeSlots = useCallback(() => {
    return agendaSettings.timeSlots.filter(time => 
      isWorkingTime(time)
    );
  }, [agendaSettings.timeSlots, isWorkingTime]);

  // Validações
  const validateTimeSlot = useCallback((time: string, dayOfWeek: number) => {
    const errors: string[] = [];

    if (!isWorkingDay(dayOfWeek)) {
      errors.push('Dia não é dia útil');
    }

    if (!isWorkingTime(time)) {
      errors.push('Horário fora do expediente');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [isWorkingDay, isWorkingTime]);

  return {
    // Estado
    settings: agendaSettings,

    // Atualizações
    updatePreferredView,
    updateTimeSlots,
    updateWorkingDays,
    updateWorkingHours,
    updateConflictResolution,
    updateSettings: updateAgendaSettings,

    // Helpers
    isWorkingDay,
    isWorkingTime,
    getAvailableTimeSlots,
    validateTimeSlot
  };
};