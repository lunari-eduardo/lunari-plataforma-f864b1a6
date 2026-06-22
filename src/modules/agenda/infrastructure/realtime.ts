/**
 * Realtime do módulo Agenda.
 *
 * Assina canais Supabase para `appointments` e `availability_slots` do usuário
 * corrente e publica eventos no `eventBus`. O `AgendaInvalidationBridge` cuida
 * de invalidar o cache TanStack a partir desses eventos.
 *
 * Isto NÃO substitui imediatamente os canais existentes em `AgendaContext`
 * (legado) — coexiste com eles até o Wave 7d remover o context.
 */
import { supabase } from "@/integrations/supabase/client";
import { eventBus } from "@/shared/event-bus";
import "../domain/events";

type Unsubscribe = () => void;

interface AppointmentRow {
  id: string;
  date: string;
  time: string;
  status: string;
  cliente_id?: string | null;
  user_id: string;
}

interface AvailabilityRow {
  id: string;
  date: string;
  user_id: string;
}

function emitAppointmentEvent(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: AppointmentRow | undefined,
  oldRow: AppointmentRow | undefined,
) {
  if (eventType === "INSERT" && row) {
    const status = row.status === "confirmado" ? "confirmado" : "a confirmar";
    void eventBus.emit("agenda.appointment.created", {
      appointmentId: row.id,
      clienteId: row.cliente_id ?? undefined,
      date: row.date,
      time: row.time,
      status,
    }, { source: "agenda.realtime", actorId: row.user_id });
    return;
  }

  if (eventType === "UPDATE" && row) {
    const prev = oldRow;
    // Reagendamento (data/hora mudou)
    if (prev && (prev.date !== row.date || prev.time !== row.time)) {
      void eventBus.emit("agenda.appointment.rescheduled", {
        appointmentId: row.id,
        from: { date: prev.date, time: prev.time },
        to: { date: row.date, time: row.time },
      }, { source: "agenda.realtime", actorId: row.user_id });
      return;
    }
    // Confirmação (status virou confirmado)
    if (prev && prev.status !== "confirmado" && row.status === "confirmado") {
      void eventBus.emit("agenda.appointment.confirmed", {
        appointmentId: row.id,
        previousStatus: "a confirmar",
        date: row.date,
        time: row.time,
      }, { source: "agenda.realtime", actorId: row.user_id });
      return;
    }
    // Fallback genérico: emitir "rescheduled" sem mudança força invalidação
    void eventBus.emit("agenda.appointment.rescheduled", {
      appointmentId: row.id,
      from: { date: prev?.date ?? row.date, time: prev?.time ?? row.time },
      to: { date: row.date, time: row.time },
    }, { source: "agenda.realtime", actorId: row.user_id });
    return;
  }

  if (eventType === "DELETE" && oldRow) {
    void eventBus.emit("agenda.appointment.cancelled", {
      appointmentId: oldRow.id,
      action: "remove",
    }, { source: "agenda.realtime", actorId: oldRow.user_id });
  }
}

function emitAvailabilityEvent(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: AvailabilityRow | undefined,
  oldRow: AvailabilityRow | undefined,
) {
  const date = row?.date ?? oldRow?.date;
  const userId = row?.user_id ?? oldRow?.user_id ?? null;
  if (!date) return;
  const operation: "add" | "clear" | "delete" =
    eventType === "INSERT" ? "add" : eventType === "DELETE" ? "delete" : "clear";
  void eventBus.emit("agenda.availability.changed", {
    date,
    operation,
  }, { source: "agenda.realtime", actorId: userId });
}

/**
 * Abre canais realtime e publica no eventBus. Retorna função de cleanup.
 */
export function subscribeAgendaRealtime(userId: string): Unsubscribe {
  const channelId = Date.now();

  const appointmentsChannel = supabase
    .channel(`agenda_module_appointments_${channelId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "appointments",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        emitAppointmentEvent(
          payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          payload.new as AppointmentRow | undefined,
          payload.old as AppointmentRow | undefined,
        );
      },
    )
    .subscribe();

  const availabilityChannel = supabase
    .channel(`agenda_module_availability_${channelId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "availability_slots",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        emitAvailabilityEvent(
          payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          payload.new as AvailabilityRow | undefined,
          payload.old as AvailabilityRow | undefined,
        );
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(appointmentsChannel);
    supabase.removeChannel(availabilityChannel);
  };
}
