/**
 * Snapshot da página Agenda para o Assistente Lu (v1).
 *
 * Injetado no prompt para dar à Lu consciência do estado visível ANTES
 * de propor ações. Não é fonte de verdade — reflete o que a UI passa.
 * Operações devem sempre passar pelas capabilities `agenda.*`.
 *
 * Limites:
 *  - `visibleAppointmentIds` ≤ 50
 *  - `availabilityToday` ≤ 50
 *  - Payload alvo ≤ ~8 KB serializado
 */

import type { AuthUser } from "@/shared/ports";
import type { Appointment, AvailabilitySlot } from "../domain/types";
import { hasConfirmedConflict, addDaysISO } from "../domain/conflict";
import { listAgendaAICapabilityIds } from "./permissions";

export type AgendaView = "daily" | "weekly" | "monthly" | "annual";

export interface AgendaPageSnapshot {
  version: 1;
  route: "/agenda";
  view: AgendaView;
  focusDate: string; // yyyy-MM-dd
  range: { start: string; end: string };
  counts: {
    total: number;
    confirmado: number;
    aConfirmar: number;
  };
  visibleAppointmentIds: string[];
  nextAppointment: {
    id: string;
    date: string;
    time: string;
    status: Appointment["status"];
  } | null;
  availabilityToday: Array<{
    id: string;
    time: string;
    duration: number;
    label?: string;
  }>;
  conflictsHint: boolean;
  permissions: {
    canWrite: boolean;
    canDelete: boolean;
    isAuthenticated: boolean;
  };
  capabilities: string[];
  userTz: string;
  notes: string[];
}

export interface BuildAgendaSnapshotInput {
  user: AuthUser | null;
  view?: AgendaView;
  /** yyyy-MM-dd — default: hoje (local). */
  focusDate?: string;
  appointments?: Appointment[];
  availabilitySlots?: AvailabilitySlot[];
  /** Limite de agendamentos visíveis (default 50). */
  maxVisible?: number;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeFor(view: AgendaView, focus: string): { start: string; end: string } {
  switch (view) {
    case "daily":
      return { start: focus, end: focus };
    case "weekly":
      return { start: focus, end: addDaysISO(focus, 6) };
    case "monthly": {
      const [y, m] = focus.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { start, end };
    }
    case "annual": {
      const [y] = focus.split("-").map(Number);
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
  }
}

export function buildAgendaPageSnapshot(
  input: BuildAgendaSnapshotInput,
): AgendaPageSnapshot {
  const {
    user,
    view = "monthly",
    focusDate = todayISO(),
    appointments = [],
    availabilitySlots = [],
    maxVisible = 50,
  } = input;

  const range = rangeFor(view, focusDate);
  const inRange = appointments.filter(
    (a) => a.date >= range.start && a.date <= range.end,
  );

  const counts = {
    total: inRange.length,
    confirmado: inRange.filter((a) => a.status === "confirmado").length,
    aConfirmar: inRange.filter((a) => a.status === "a confirmar").length,
  };

  const sortedByDateTime = [...inRange].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.time < b.time ? -1 : 1;
  });

  const visibleAppointmentIds = sortedByDateTime.slice(0, maxVisible).map((a) => a.id);

  const now = new Date();
  const nowISO = todayISO();
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const upcoming = [...appointments]
    .filter((a) => a.date > nowISO || (a.date === nowISO && a.time >= nowHHMM))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.time < b.time ? -1 : 1;
    })[0];

  const nextAppointment = upcoming
    ? {
        id: upcoming.id,
        date: upcoming.date,
        time: upcoming.time,
        status: upcoming.status,
      }
    : null;

  const availabilityToday = availabilitySlots
    .filter((s) => s.date === focusDate)
    .slice(0, maxVisible)
    .map((s) => ({
      id: s.id,
      time: s.time,
      duration: s.duration,
      label: s.label,
    }));

  // Sinaliza se algum agendamento a confirmar colide com um confirmado
  const conflictsHint = inRange.some(
    (a) =>
      a.status === "a confirmar" &&
      hasConfirmedConflict(appointments, { date: a.date, time: a.time }, a.id),
  );

  return {
    version: 1,
    route: "/agenda",
    view,
    focusDate,
    range,
    counts,
    visibleAppointmentIds,
    nextAppointment,
    availabilityToday,
    conflictsHint,
    permissions: {
      canWrite: !!user,
      canDelete: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listAgendaAICapabilityIds(),
    userTz: "America/Sao_Paulo",
    notes: [
      "Datas são ISO yyyy-MM-dd no fuso local do usuário. Não converter para UTC.",
      "Nunca escreva `status` financeiro daqui — é gerado por trigger.",
      "Reagendamento é idempotente por (id, date, time) — repetir é no-op.",
      "cancelAppointment com action=refund aciona estorno financeiro e exige aprovação humana.",
      "Slots confirmados não aceitam outro confirmado no mesmo (date, time).",
    ],
  };
}

export function snapshotForAgenda(user: AuthUser | null): AgendaPageSnapshot {
  // Fallback sem viewState: snapshot mínimo do mês corrente sem dados carregados.
  return buildAgendaPageSnapshot({ user });
}

export function debugAgendaSnapshot(s: AgendaPageSnapshot): Record<string, unknown> {
  return {
    route: s.route,
    view: s.view,
    focusDate: s.focusDate,
    counts: s.counts,
    visible: s.visibleAppointmentIds.length,
    availability: s.availabilityToday.length,
    capabilities: s.capabilities.length,
  };
}
