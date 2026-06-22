import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok, err } from "@/shared/result";
import { agendaError, AgendaErrorCodes } from "../../domain/errors";
import { AppointmentSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({ id: z.string().min(1) });

export const confirmAppointment = defineCommand({
  id: "agenda.appointments.confirm",
  title: "Confirmar agendamento",
  description:
    "Marca um agendamento como confirmado. Disparará criação da sessão de workflow e ocupação do slot.",
  input: Input,
  output: AppointmentSchema,
  permissions: ["agenda:write"],
  sideEffects: [
    "db:appointments",
    "event:agenda.appointment.confirmed",
  ],
  audit: "on-success",
  idempotencyKey: (i) => `agenda.confirm:${i.id}`,
  async handler({ id }, ctx) {
    const { appointments } = getAgendaDeps();
    const current = await appointments.getById(id);
    if (!current) {
      return err(
        agendaError(AgendaErrorCodes.AppointmentNotFound, "Agendamento não encontrado.", { id }),
      );
    }
    if (current.status === "confirmado") {
      return ok(current);
    }
    await appointments.update(id, { status: "confirmado" });
    await ctx.emit("agenda.appointment.confirmed", {
      appointmentId: id,
      previousStatus: "a confirmar",
      date: current.date,
      time: current.time,
    });
    const updated = await appointments.getById(id);
    return ok(updated ?? { ...current, status: "confirmado" });
  },
});
