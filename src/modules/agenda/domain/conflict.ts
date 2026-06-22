/**
 * Lógica pura de conflitos e disponibilidade.
 * Sem dependências externas — testável isoladamente.
 */
import type { Appointment, AvailabilitySlot } from "./types";

export interface SlotKey {
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
}

export const sameSlot = (a: SlotKey, b: SlotKey): boolean =>
  a.date === b.date && a.time === b.time;

/** Retorna agendamentos que ocupam o mesmo slot. */
export function findConflicts(
  appointments: readonly Appointment[],
  slot: SlotKey,
  options: { excludeId?: string; onlyConfirmed?: boolean } = {},
): Appointment[] {
  return appointments.filter((a) => {
    if (options.excludeId && a.id === options.excludeId) return false;
    if (options.onlyConfirmed && a.status !== "confirmado") return false;
    return sameSlot({ date: a.date, time: a.time }, slot);
  });
}

/** True se houver pelo menos 1 agendamento confirmado naquele slot. */
export function hasConfirmedConflict(
  appointments: readonly Appointment[],
  slot: SlotKey,
  excludeId?: string,
): boolean {
  return findConflicts(appointments, slot, { excludeId, onlyConfirmed: true }).length > 0;
}

/** Adiciona N dias a um ISO `yyyy-MM-dd` mantendo calendário local. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Encontra o próximo slot livre dentro de `horizonDays`.
 * Retorna `null` se nenhum slot estiver disponível.
 */
export function findNextFreeSlot(
  availability: readonly AvailabilitySlot[],
  appointments: readonly Appointment[],
  from: SlotKey,
  horizonDays = 30,
): SlotKey | null {
  for (let i = 0; i < horizonDays; i++) {
    const date = addDaysISO(from.date, i);
    const slots = availability
      .filter((s) => s.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));

    for (const s of slots) {
      if (i === 0 && s.time <= from.time) continue;
      if (!hasConfirmedConflict(appointments, { date, time: s.time })) {
        return { date, time: s.time };
      }
    }
  }
  return null;
}
