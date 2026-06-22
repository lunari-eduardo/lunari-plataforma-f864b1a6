import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { NewAppointmentSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  id: z.string().min(1),
  patch: NewAppointmentSchema.partial(),
});

/**
 * Atualização genérica de campos arbitrários de um agendamento.
 * Para mudanças exclusivas de data/hora prefira `rescheduleAppointment`,
 * que emite o evento `agenda.appointment.rescheduled`.
 */
export const updateAppointment = defineCommand({
  id: "agenda.appointments.update",
  title: "Atualizar agendamento",
  description: "Aplica um patch parcial em um agendamento existente.",
  input: Input,
  output: z.object({ ok: z.literal(true) }),
  permissions: ["agenda:write"],
  sideEffects: ["db:appointments", "event:agenda.appointment.updated"],
  audit: "on-success",
  async handler({ id, patch }, ctx) {
    const { appointments } = getAgendaDeps();
    await appointments.update(id, patch);
    await ctx.emit("agenda.appointment.updated", { appointmentId: id, patch });
    return ok({ ok: true as const });
  },
});
