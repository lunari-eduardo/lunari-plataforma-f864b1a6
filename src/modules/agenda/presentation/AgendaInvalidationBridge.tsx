/**
 * Bridge entre o `eventBus` (domínio) e o cache do TanStack Query (UI).
 *
 * Sempre que uma capability do módulo Agenda emite um evento declarado em
 * `domain/events.ts`, invalidamos as queries afetadas. Isso garante que
 * múltiplas abas/janelas do mesmo usuário convirjam sem precisar acoplar a
 * UI ao realtime do Supabase.
 *
 * Montar UMA vez perto da raiz da app (dentro de QueryClientProvider).
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { eventBus } from "@/shared/event-bus";
import { agendaKeys } from "./keys";

export const AgendaInvalidationBridge: React.FC = () => {
  const qc = useQueryClient();

  React.useEffect(() => {
    const offs = [
      eventBus.on("agenda.appointment.created", () => {
        qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
        qc.invalidateQueries({ queryKey: agendaKeys.availability() });
      }),
      eventBus.on("agenda.appointment.confirmed", (e) => {
        qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
        qc.invalidateQueries({ queryKey: agendaKeys.appointmentById(e.payload.appointmentId) });
      }),
      eventBus.on("agenda.appointment.rescheduled", (e) => {
        qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
        qc.invalidateQueries({ queryKey: agendaKeys.availability() });
        qc.invalidateQueries({ queryKey: agendaKeys.appointmentById(e.payload.appointmentId) });
      }),
      eventBus.on("agenda.appointment.cancelled", (e) => {
        qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
        qc.invalidateQueries({ queryKey: agendaKeys.availability() });
        qc.invalidateQueries({ queryKey: agendaKeys.appointmentById(e.payload.appointmentId) });
      }),
      eventBus.on("agenda.appointment.updated", (e) => {
        qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
        qc.invalidateQueries({ queryKey: agendaKeys.availability() });
        qc.invalidateQueries({ queryKey: agendaKeys.appointmentById(e.payload.appointmentId) });
      }),
      eventBus.on("agenda.availability.changed", () => {
        qc.invalidateQueries({ queryKey: agendaKeys.availability() });
      }),
    ];
    return () => {
      offs.forEach((off) => off());
    };
  }, [qc]);

  return null;
};
