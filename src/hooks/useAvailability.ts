import { useMemo } from 'react';
import { useAgendaContext } from '@/contexts/AgendaContext';
import {
  useAvailabilityQuery,
  useAddAvailabilityMutation,
  useClearAvailabilityMutation,
  useDeleteAvailabilitySlotMutation,
} from '@/modules/agenda/presentation';
import type { AvailabilitySlot } from '@/types/availability';

/**
 * @deprecated Prefira `useAvailabilityQuery`, `useAddAvailabilityMutation`,
 * `useClearAvailabilityMutation` e `useDeleteAvailabilitySlotMutation` direto
 * de `@/modules/agenda`. Este shim mantém a API antiga para compatibilidade:
 * - `availability` e as 3 mutations de slot agora vêm do módulo (Onda 7a/7b).
 * - `availabilityTypes` + CRUD de tipos seguem no `AgendaContext` até a
 *   modularização dos tipos (onda futura).
 */

// Range amplo: `listAvailability` ignora o range (input vazio no schema),
// então estes valores apenas servem como queryKey estável.
const WIDE_RANGE = { start: '1970-01-01', end: '2999-12-31' } as const;

export const useAvailability = () => {
  const ctx = useAgendaContext();

  const { data } = useAvailabilityQuery(WIDE_RANGE);
  const addMut = useAddAvailabilityMutation();
  const clearMut = useClearAvailabilityMutation();
  const deleteMut = useDeleteAvailabilitySlotMutation();

  const availability = (data ?? []) as AvailabilitySlot[];

  return useMemo(
    () => ({
      availability,
      availabilityTypes: ctx.availabilityTypes,
      addAvailabilitySlots: async (slots: Omit<AvailabilitySlot, 'id'>[]) => {
        await addMut.mutateAsync({ slots });
      },
      clearAvailabilityForDate: async (date: string) => {
        await clearMut.mutateAsync({ date });
      },
      deleteAvailabilitySlot: async (id: string) => {
        await deleteMut.mutateAsync({ id });
      },
      addAvailabilityType: ctx.addAvailabilityType,
      updateAvailabilityType: ctx.updateAvailabilityType,
      deleteAvailabilityType: ctx.deleteAvailabilityType,
    }),
    [
      availability,
      ctx.availabilityTypes,
      ctx.addAvailabilityType,
      ctx.updateAvailabilityType,
      ctx.deleteAvailabilityType,
      addMut,
      clearMut,
      deleteMut,
    ],
  );
};
