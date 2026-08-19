/**
 * Hook de leitura de eventos unificados (appointments + orçamentos)
 * para uma faixa de datas (yyyy-MM-dd). Consome `useAppointmentsRangeQuery`
 * do módulo e mapeia para o shape `UnifiedEvent` consumido pelas views da Agenda.
 *
 * Nota: o sistema legado de orçamentos foi removido — o array `budgetEvents`
 * é deixado vazio para preservar o contrato, podendo ser reabilitado quando
 * um módulo `orcamentos` for migrado.
 */
import { useMemo } from "react";
import { parseDateFromStorage } from "@/utils/dateUtils";
import type { Appointment as LegacyAppointment } from "./types";
import {
  useAppointmentsRangeQuery,
  type AgendaRange,
} from "./queries";

export interface UnifiedEvent {
  id: string;
  type: "appointment" | "budget" | "task";
  agendaType?: "session" | "personal" | "meeting" | "task";
  title: string;
  date: Date;
  time: string;
  durationMinutes?: number;
  client: string;
  status: string;
  description?: string;
  originalData: LegacyAppointment;
}

export function useUnifiedEventsRangeQuery(
  range: AgendaRange,
  options?: { enabled?: boolean },
) {
  const query = useAppointmentsRangeQuery(range, options);
  const appointments = query.data ?? [];

  const unifiedEvents = useMemo<UnifiedEvent[]>(() => {
    return appointments.map((appointment) => {
      const agendaType = appointment.agendaType || 
        (appointment.type === 'personal' || appointment.type === 'pessoal' ? 'personal' : 
         appointment.type === 'meeting' || appointment.type === 'reuniao' ? 'meeting' : 'session');

      const durationMinutes = Number(appointment.durationMinutes) || 60;

      const legacy: LegacyAppointment = {
        id: appointment.id,
        sessionId: appointment.sessionId,
        title: appointment.title,
        date: parseDateFromStorage(appointment.date),
        time: appointment.time,
        type: appointment.type,
        agendaType,
        durationMinutes,
        location: appointment.location,
        client: appointment.client,
        status: appointment.status,
        description: appointment.description,
        packageId: appointment.packageId,
        produtosIncluidos: appointment.produtosIncluidos as never,
        paidAmount: appointment.paidAmount,
        email: appointment.email,
        whatsapp: appointment.whatsapp,
        orcamentoId: appointment.orcamentoId,
        origem: appointment.origem,
        clienteId: appointment.clienteId,
      } as LegacyAppointment;

      return {
        id: `appointment-${legacy.id}`,
        type: "appointment" as const,
        agendaType,
        title: legacy.title,
        date: legacy.date,
        time: legacy.time,
        durationMinutes,
        client: legacy.client,
        status: legacy.status,
        description: legacy.description,
        originalData: legacy,
      };
    });
  }, [appointments]);

  const { dateMap, slotMap } = useMemo(() => {
    const d = new Map<string, UnifiedEvent[]>();
    const s = new Map<string, UnifiedEvent>();
    for (const event of unifiedEvents) {
      const dateKey = event.date.toDateString();
      if (!d.has(dateKey)) d.set(dateKey, []);
      d.get(dateKey)!.push(event);
      const slotKey = `${dateKey}_${event.time}`;
      if (!s.has(slotKey)) s.set(slotKey, event);
    }
    for (const events of d.values()) {
      events.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
    }
    return { dateMap: d, slotMap: s };
  }, [unifiedEvents]);

  const getEventsForDate = useMemo(
    () => (date: Date) => dateMap.get(date.toDateString()) ?? [],
    [dateMap],
  );

  const getEventForSlot = useMemo(
    () => (date: Date, time: string) => slotMap.get(`${date.toDateString()}_${time}`),
    [slotMap],
  );

  return {
    ...query,
    unifiedEvents,
    getEventsForDate,
    getEventForSlot,
  };
}
