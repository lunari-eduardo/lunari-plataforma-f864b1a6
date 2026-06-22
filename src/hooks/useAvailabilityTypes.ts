import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AgendaService } from '@/services/AgendaService';
import { SupabaseAgendaAdapter } from '@/adapters/SupabaseAgendaAdapter';
import { agendaKeys } from '@/modules/agenda/presentation/keys';
import type { AvailabilityType } from '@/types/availability';

/**
 * Hook standalone para CRUD de tipos de disponibilidade (cores/labels).
 * Substitui o estado homônimo que vivia em `AgendaContext` (removido na onda 7d3).
 */
const service = new AgendaService(new SupabaseAgendaAdapter());

export function useAvailabilityTypes() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: agendaKeys.availabilityTypes(),
    queryFn: () => service.loadAvailabilityTypes(),
    staleTime: 60_000,
  });

  const availabilityTypes = useMemo<AvailabilityType[]>(() => data ?? [], [data]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: agendaKeys.availabilityTypes() });
  }, [queryClient]);

  const addMut = useMutation({
    mutationFn: (typeData: Omit<AvailabilityType, 'id'>) => service.addAvailabilityType(typeData),
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AvailabilityType> }) =>
      service.updateAvailabilityType(id, updates),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => service.deleteAvailabilityType(id),
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
