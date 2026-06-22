import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { getAgendaDeps } from "../../infrastructure/container";

export const deleteAvailabilitySlot = defineCommand({
  id: "agenda.availability.deleteSlot",
  title: "Excluir slot de disponibilidade",
  description: "Remove um slot de disponibilidade específico pelo ID.",
  input: z.object({ id: z.string().min(1) }),
  output: z.object({ ok: z.literal(true) }),
  permissions: ["agenda:write"],
  sideEffects: ["db:availability_slots", "event:agenda.availability.changed"],
  audit: "on-success",
  idempotencyKey: (i) => `agenda.availability.deleteSlot:${i.id}`,
  async handler({ id }, ctx) {
    const { availability } = getAgendaDeps();
    await availability.delete(id);
    await ctx.emit("agenda.availability.changed", { date: "", operation: "delete" });
    return ok({ ok: true as const });
  },
});
