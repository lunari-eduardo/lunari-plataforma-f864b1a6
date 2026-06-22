import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AgendaService } from '@/services/AgendaService';
import { SupabaseAgendaAdapter } from '@/adapters/SupabaseAgendaAdapter';
import { agendaKeys } from '@/modules/agenda/presentation/keys';
import type { AgendaSettings } from '@/types/agenda-supabase';

/**
 * Hook standalone para as configurações da Agenda (settings).
 * Substitui o consumo via `AgendaContext` (removido na onda 7d3).
 */
const service = new AgendaService(new SupabaseAgendaAdapter());

const DEFAULT_SETTINGS: AgendaSettings = {
  defaultView: 'weekly',
  workingHours: { start: '08:00', end: '18:00' },
  autoConfirmAppointments: false,
};

export const useAgendaSettings = () => {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: agendaKeys.settings(),
    queryFn: () => service.loadSettings(),
    staleTime: 60_000,
  });

  const settings = useMemo<AgendaSettings>(() => data ?? DEFAULT_SETTINGS, [data]);

  const saveMut = useMutation({
    mutationFn: (next: AgendaSettings) => service.saveSettings(next),
    onSuccess: (_v, next) => {
      queryClient.setQueryData(agendaKeys.settings(), next);
    },
  });

  const updateSettings = useCallback(
    (next: AgendaSettings) => saveMut.mutateAsync(next),
    [saveMut],
  );

  return {
    settings,
    updateSettings,

    defaultView: settings.defaultView,
    workingHours: settings.workingHours,
    autoConfirmAppointments: settings.autoConfirmAppointments,
    defaultTimeSlots: settings.defaultTimeSlots,

    setDefaultView: (view: AgendaSettings['defaultView']) =>
      updateSettings({ ...settings, defaultView: view }),
    setWorkingHours: (workingHours: { start: string; end: string }) =>
      updateSettings({ ...settings, workingHours }),
    setAutoConfirmAppointments: (autoConfirm: boolean) =>
      updateSettings({ ...settings, autoConfirmAppointments: autoConfirm }),
    setDefaultTimeSlots: (slots: string[]) =>
      updateSettings({ ...settings, defaultTimeSlots: [...slots].sort() }),
  };
};
