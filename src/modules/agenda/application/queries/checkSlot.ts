import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { ok } from "@/shared/result";
import {
  AppointmentSchema,
  AvailabilitySlotSchema,
  IsoDateSchema,
  TimeSchema,
} from "../../domain/types";
import { classifySlot } from "../../domain/slotClassification";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  date: IsoDateSchema,
  time: TimeSchema,
  excludeAppointmentId: z.string().optional(),
});

const Output = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("free") }),
  z.object({ kind: z.literal("busy"), appointment: AppointmentSchema }),
  z.object({ kind: z.literal("pending"), appointments: z.array(AppointmentSchema) }),
  z.object({ kind: z.literal("blocked"), slot: AvailabilitySlotSchema }),
]);

/**
 * Capability `agenda.slot.check` — classifica um slot (livre, ocupado, pendente
 * ou bloqueado) carregando agendamentos e disponibilidade do dia. Reutiliza a
 * função pura `classifySlot` do domínio. Útil para UIs de marcação e para o
 * AI Assistant antes de propor um agendamento.
 */
export const checkSlot = defineQuery({
  id: "agenda.slot.check",
  title: "Verificar disponibilidade de um slot",
  description:
    "Verifica se um par data/hora está livre, ocupado por um agendamento confirmado, com pendentes, ou em um slot bloqueado.",
  input: Input,
  output: Output,
  permissions: ["agenda:read"],
  costHint: "cheap",
  examples: [
    {
      nl: "Verifica se 12/07 às 14:00 está livre",
      input: { date: "2026-07-12", time: "14:00" },
    },
  ],
  async handler(input) {
    const { appointments, availability } = getAgendaDeps();
    const [appts, slots] = await Promise.all([
      appointments.listByRange({ start: input.date, end: input.date }),
      availability.list(),
    ]);
    const result = classifySlot(appts, slots, {
      date: input.date,
      time: input.time,
      excludeAppointmentId: input.excludeAppointmentId,
    });
    return ok(result);
  },
});
