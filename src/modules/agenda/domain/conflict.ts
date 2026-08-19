/**
 * Lógica pura de conflitos e disponibilidade.
 * Sem dependências externas — testável isoladamente.
 */
import type { Appointment, AvailabilitySlot } from "./types";

export interface SlotKey {
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
}

/** Converte "HH:mm" em minutos a partir de 00:00 (ex: "15:30" -> 930). */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h * 60 + m;
}

/** Converte minutos em "HH:mm" (ex: 930 -> "15:30"). */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Calcula horário final somando duração em minutos (ex: "15:00" + 180 -> "18:00"). */
export function getEventEndTime(startTime: string, durationMinutes: number = 60): string {
  const startMin = timeToMinutes(startTime);
  return minutesToTime(startMin + (durationMinutes || 60));
}

/**
 * Verifica se um slot específico ("HH:mm") está coberto por um evento que
 * inicia em `eventStartTime` com duração `durationMinutes`.
 * Ex: slot "16:00" está coberto por evento das "15:00" com 180 min (15:00 - 18:00).
 */
export function isSlotCoveredByEvent(
  slotTime: string,
  eventStartTime: string,
  durationMinutes: number = 60
): boolean {
  const slotMin = timeToMinutes(slotTime);
  const startMin = timeToMinutes(eventStartTime);
  const endMin = startMin + (durationMinutes || 60);
  return slotMin >= startMin && slotMin < endMin;
}

/**
 * Verifica se dois intervalos de horário se sobrepõem na mesma data.
 */
export function doIntervalsOverlap(
  timeA: string,
  durationA: number = 60,
  timeB: string,
  durationB: number = 60
): boolean {
  const startA = timeToMinutes(timeA);
  const endA = startA + (durationA || 60);
  const startB = timeToMinutes(timeB);
  const endB = startB + (durationB || 60);
  return startA < endB && startB < endA;
}

export const sameSlot = (a: SlotKey, b: SlotKey): boolean =>
  a.date === b.date && a.time === b.time;

/** Retorna agendamentos que ocupam ou sobrepõem o slot/intervalo na mesma data. */
export function findConflicts(
  appointments: readonly Appointment[],
  slot: SlotKey & { durationMinutes?: number },
  options: { excludeId?: string; onlyConfirmed?: boolean } = {},
): Appointment[] {
  const targetDuration = slot.durationMinutes || 60;
  return appointments.filter((a) => {
    if (options.excludeId && a.id === options.excludeId) return false;
    if (options.onlyConfirmed && a.status !== "confirmado") return false;
    if (a.date !== slot.date) return false;
    const appDuration = a.durationMinutes || 60;
    return doIntervalsOverlap(a.time, appDuration, slot.time, targetDuration);
  });
}

/** True se houver pelo menos 1 agendamento confirmado naquele slot ou intervalo. */
export function hasConfirmedConflict(
  appointments: readonly Appointment[],
  slot: SlotKey & { durationMinutes?: number },
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
