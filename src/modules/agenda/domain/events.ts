/**
 * Catálogo de eventos do módulo Agenda.
 * Declaration merging em LunariEvents — permite que outros módulos
 * (Workflow, Financeiro, Notificações) assinem com tipagem total.
 */
import "@/shared/event-bus";

declare module "@/shared/event-bus" {
  interface LunariEvents {
    "agenda.appointment.created": {
      appointmentId: string;
      clienteId?: string;
      date: string;
      time: string;
      status: "confirmado" | "a confirmar";
    };
    "agenda.appointment.confirmed": {
      appointmentId: string;
      previousStatus: "a confirmar";
      date: string;
      time: string;
    };
    "agenda.appointment.rescheduled": {
      appointmentId: string;
      from: { date: string; time: string };
      to: { date: string; time: string };
      reason?: string;
    };
    "agenda.appointment.cancelled": {
      appointmentId: string;
      action: "preserve" | "refund" | "remove";
    };
    "agenda.availability.changed": {
      date: string;
      operation: "add" | "clear" | "delete";
    };
  }
}

export {}; // garante que o arquivo é tratado como módulo
