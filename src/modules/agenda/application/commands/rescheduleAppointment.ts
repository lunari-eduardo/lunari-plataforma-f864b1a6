import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { err, ok } from "@/shared/result";
import { IsoDateSchema, TimeSchema } from "../../domain/types";
import { agendaError, AgendaErrorCodes } from "../../domain/errors";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  id: z.string().min(1),
  date: IsoDateSchema,
  time: TimeSchema,
  reason: z.string().max(500).optional(),
});

export const rescheduleAppointment = defineCommand({
  id: "agenda.appointments.reschedule",
  title: "Reagendar",
  description:
    "Altera data e hora de um agendamento existente. Idempotente por (id, date, time).",
  input: Input,
  output: z.object({ ok: z.literal(true) }),
  permissions: ["agenda:write"],
  sideEffects: ["db:appointments", "event:agenda.appointment.rescheduled"],
  audit: "on-success",
  needsApproval: ({ input }) => Boolean(input.reason && input.reason.length > 0) === false,
  idempotencyKey: (i) => `agenda.reschedule:${i.id}:${i.date}:${i.time}`,
  async handler(input, ctx) {
    const { appointments } = getAgendaDeps();
    const current = await appointments.getById(input.id);
    if (!current) {
      return err(
        agendaError(AgendaErrorCodes.AppointmentNotFound, "Agendamento não encontrado.", {
          id: input.id,
        }),
      );
    }

    if (current.date === input.date && current.time === input.time) {
      return ok({ ok: true as const });
    }

    await appointments.update(input.id, { date: input.date, time: input.time });
    await ctx.emit("agenda.appointment.rescheduled", {
      appointmentId: input.id,
      from: { date: current.date, time: current.time },
      to: { date: input.date, time: input.time },
      reason: input.reason,
    });
    return ok({ ok: true as const });
  },
});
