import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAgendaDeps } from '@/modules/agenda/infrastructure/container';
import { agendaKeys } from '@/modules/agenda/presentation/keys';
import type { AvailabilityType } from '@/types/availability';

/**
 * Hook standalone para CRUD de tipos de disponibilidade (cores/labels).
 * Onda 7e1: passa a falar direto com o repo do módulo (sem AgendaService/legacy adapter).
 */
export function useAvailabilityTypes() {
  const queryClient = useQueryClient();
  const { availabilityTypes: repo } = getAgendaDeps();

  const { data } = useQuery({
    queryKey: agendaKeys.availabilityTypes(),
    queryFn: () => repo.list(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const availabilityTypes = useMemo<AvailabilityType[]>(() => data ?? [], [data]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: agendaKeys.availabilityTypes() });
  }, [queryClient]);

  const addMut = useMutation({
    mutationFn: (typeData: Omit<AvailabilityType, 'id'>) => repo.add(typeData),
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AvailabilityType> }) =>
      repo.update(id, updates),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => repo.delete(id),
    onSuccess: invalidate,
  });

  return {
    availabilityTypes,
    addAvailabilityType: (typeData: Omit<AvailabilityType, 'id'>) => addMut.mutateAsync(typeData),
    updateAvailabilityType: (id: string, updates: Partial<AvailabilityType>) =>
      updateMut.mutateAsync({ id, updates }),
    deleteAvailabilityType: (id: string) => deleteMut.mutateAsync(id),
  };
}
