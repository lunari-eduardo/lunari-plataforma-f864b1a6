import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { DeletionActionSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  id: z.string().min(1),
  action: DeletionActionSchema.default("remove"),
});

export const cancelAppointment = defineCommand({
  id: "agenda.appointments.cancel",
  title: "Cancelar agendamento",
  description:
    "Cancela um agendamento. `action` controla tratamento de cobranças vinculadas: preserve (mantém), refund (estorna), remove (apaga).",
  input: Input,
  output: z.object({ ok: z.literal(true) }),
  permissions: ["agenda:write"],
  sideEffects: ["db:appointments", "event:agenda.appointment.cancelled"],
  audit: "always",
  needsApproval: ({ input }) => input.action !== "preserve",
  idempotencyKey: (i) => `agenda.cancel:${i.id}:${i.action}`,
  async handler({ id, action }, ctx) {
    const { appointments } = getAgendaDeps();
    await appointments.delete(id, action);
    await ctx.emit("agenda.appointment.cancelled", { appointmentId: id, action });
    return ok({ ok: true as const });
  },
});
