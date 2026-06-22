import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { AppointmentSchema, NewAppointmentSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

export const createAppointment = defineCommand({
  id: "agenda.appointments.create",
  title: "Criar agendamento",
  description:
    "Cria um agendamento. Se o status for 'confirmado', o slot correspondente é ocupado e uma sessão do workflow é criada automaticamente pelo banco.",
  input: NewAppointmentSchema,
  output: AppointmentSchema,
  permissions: ["agenda:write"],
  sideEffects: ["db:appointments", "event:agenda.appointment.created"],
  audit: "on-success",
  async handler(input, ctx) {
    const { appointments } = getAgendaDeps();
    const created = await appointments.create(input);
    await ctx.emit("agenda.appointment.created", {
      appointmentId: created.id,
      clienteId: created.clienteId,
      date: created.date,
      time: created.time,
      status: created.status,
    });
    return ok(created);
  },
});
