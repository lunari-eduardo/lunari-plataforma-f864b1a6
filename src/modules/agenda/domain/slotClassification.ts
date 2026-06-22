/**
 * Lógica pura de classificação de um slot da agenda.
 * Sem React, sem Supabase — recebe coleções em formato de domínio e devolve
 * um veredito tipado. Usada pela UI (hooks) e pelo motor de AI capabilities.
 */
import type { Appointment, AvailabilitySlot } from "./types";
import { findConflicts } from "./conflict";

export type SlotCheckResult =
  | { kind: "free" }
  | { kind: "busy"; appointment: Appointment }
  | { kind: "pending"; appointments: Appointment[] }
  | { kind: "blocked"; slot: AvailabilitySlot };

export interface ClassifySlotArgs {
  /** ISO yyyy-MM-dd. */
  date: string;
  /** HH:mm. */
  time: string;
  excludeAppointmentId?: string;
}

/** Identifica se um slot de disponibilidade representa um bloqueio. */
export function isBlockedSlot(s: AvailabilitySlot): boolean {
  const label = (s.label || "").toLowerCase();
  const typeId = (s.typeId || "").toLowerCase();
  if (typeId.startsWith("bloque")) return true;
  if (label.startsWith("bloque")) return true;
  if (s.isFullDay && s.fullDayDescription) return true;
  return false;
}

/**
 * Classifica um slot.
 * Ordem de prioridade:
 *  1. confirmado em outro agendamento → busy
 *  2. slot bloqueado pelo usuário → blocked
 *  3. pendentes no mesmo horário → pending
 *  4. livre
 */
export function classifySlot(
  appointments: readonly Appointment[],
  availability: readonly AvailabilitySlot[],
  args: ClassifySlotArgs,
): SlotCheckResult {
  const slot = { date: args.date, time: args.time };

  const sameSlotApps = findConflicts(appointments, slot, {
    excludeId: args.excludeAppointmentId,
  });

  const confirmed = sameSlotApps.find((a) => a.status === "confirmado");
  if (confirmed) return { kind: "busy", appointment: confirmed };

  const blocked = availability.find(
    (s) =>
      s.date === args.date &&
      isBlockedSlot(s) &&
      (s.isFullDay || s.time === args.time),
  );
  if (blocked) return { kind: "blocked", slot: blocked };

  const pendings = sameSlotApps.filter((a) => a.status === "a confirmar");
  if (pendings.length > 0) return { kind: "pending", appointments: pendings };

  return { kind: "free" };
}
