import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { IsoDateSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

export const clearAvailabilityForDate = defineCommand({
  id: "agenda.availability.clearDate",
  title: "Limpar disponibilidade de uma data",
  description: "Remove todos os slots de disponibilidade de uma data específica.",
  input: z.object({ date: IsoDateSchema }),
  output: z.object({ ok: z.literal(true) }),
  permissions: ["agenda:write"],
  sideEffects: ["db:availability_slots", "event:agenda.availability.changed"],
  audit: "on-success",
  idempotencyKey: (i) => `agenda.availability.clear:${i.date}`,
  async handler({ date }, ctx) {
    const { availability } = getAgendaDeps();
    await availability.clearForDate(date);
    await ctx.emit("agenda.availability.changed", { date, operation: "clear" });
    return ok({ ok: true as const });
  },
});
