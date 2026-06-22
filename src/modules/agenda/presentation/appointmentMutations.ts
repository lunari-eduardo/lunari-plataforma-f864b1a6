/**
 * Hook composto que expõe `addAppointment` / `updateAppointment` /
 * `deleteAppointment` em estilo legado (aceitando `Date` no campo `date`),
 * porém delegando a mutations baseadas em capabilities do módulo Agenda.
 *
 * Substitui a antiga `useLegacyAgendaMutations`, que dependia do
 * `AgendaContext` via `useAppointments`.
 */
import { useCallback } from "react";
import { formatDateForStorage } from "@/utils/dateUtils";
import {
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  useCancelAppointmentMutation,
} from "./mutations";
import type { Appointment, NewAppointment, DeletionAction } from "../domain/types";

type DateLike = Date | string;

const toIsoDate = (d: DateLike): string => {
  if (typeof d === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return formatDateForStorage(new Date(d));
  }
  return formatDateForStorage(d);
};

type LooseNewAppointment = Omit<NewAppointment, "date"> & { date: DateLike };
type LoosePatch = Partial<Omit<NewAppointment, "date">> & { date?: DateLike };

const normalizeNew = (input: LooseNewAppointment): NewAppointment => ({
  ...input,
  date: toIsoDate(input.date),
});

const normalizePatch = (patch: LoosePatch): Partial<NewAppointment> => {
  const out: Partial<NewAppointment> = { ...patch } as Partial<NewAppointment>;
  if (patch.date !== undefined) {
    out.date = toIsoDate(patch.date);
  }
  return out;
};

export function useAppointmentMutations() {
  const createM = useCreateAppointmentMutation();
  const updateM = useUpdateAppointmentMutation();
  const cancelM = useCancelAppointmentMutation();

  const addAppointment = useCallback(
    async (data: LooseNewAppointment): Promise<Appointment> => {
      const created = await createM.mutateAsync(normalizeNew(data));
      return created as Appointment;
    },
    [createM],
  );

  const updateAppointment = useCallback(
    async (id: string, patch: LoosePatch): Promise<void> => {
      await updateM.mutateAsync({ id, patch: normalizePatch(patch) });
    },
    [updateM],
  );

  const deleteAppointment = useCallback(
    async (id: string, action: DeletionAction = "remove"): Promise<void> => {
      await cancelM.mutateAsync({ id, action });
    },
    [cancelM],
  );

  return { addAppointment, updateAppointment, deleteAppointment };
}
