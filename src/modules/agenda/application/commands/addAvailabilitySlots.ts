import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { NewAvailabilitySlotSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  slots: z.array(NewAvailabilitySlotSchema).min(1),
});

export const addAvailabilitySlots = defineCommand({
  id: "agenda.availability.add",
  title: "Adicionar slots de disponibilidade",
  description: "Cria múltiplos slots de disponibilidade em lote.",
  input: Input,
  output: z.object({ created: z.number().int().nonnegative() }),
  permissions: ["agenda:write"],
  sideEffects: ["db:availability_slots", "event:agenda.availability.changed"],
  audit: "on-success",
  async handler({ slots }, ctx) {
    const { availability } = getAgendaDeps();
    await availability.addMany(slots);
    // emite um único evento agregado por data afetada (primeira)
    await ctx.emit("agenda.availability.changed", {
      date: slots[0].date,
      operation: "add",
    });
    return ok({ created: slots.length });
  },
});
