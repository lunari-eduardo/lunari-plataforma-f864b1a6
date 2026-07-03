import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAgendaDeps } from '@/modules/agenda/infrastructure/container';
import { agendaKeys } from '@/modules/agenda/presentation/keys';
import type { AgendaSettings } from '@/types/agenda-supabase';

/**
 * Hook standalone para as configurações da Agenda (settings).
 * Onda 7e2: passa a falar direto com o repo do módulo (sem AgendaService/legacy adapter).
 */
const DEFAULT_SETTINGS: AgendaSettings = {
  defaultView: 'weekly',
  workingHours: { start: '08:00', end: '18:00' },
  autoConfirmAppointments: false,
};

export const useAgendaSettings = () => {
  const queryClient = useQueryClient();
  const { settings: repo } = getAgendaDeps();

  const { data } = useQuery({
    queryKey: agendaKeys.settings(),
    queryFn: () => repo.load(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const settings = useMemo<AgendaSettings>(() => data ?? DEFAULT_SETTINGS, [data]);

  const saveMut = useMutation({
    mutationFn: (next: AgendaSettings) => repo.save(next),
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
