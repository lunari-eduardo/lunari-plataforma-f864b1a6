import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { IsoDateSchema, TimeSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  date: IsoDateSchema.describe("Data no formato YYYY-MM-DD"),
  time: TimeSchema.describe("Horário no formato HH:mm"),
});

export const unblockSlot = defineCommand({
  id: "agenda.unblockSlot",
  title: "Desbloquear horário específico",
  description: "Remove o bloqueio de um horário específico na agenda.",
  input: Input,
  output: z.object({ success: z.boolean(), date: z.string(), time: z.string() }),
  permissions: ["agenda:write"],
  sideEffects: ["db:availability_slots", "event:agenda.availability.changed"],
  audit: "on-success",
  async handler({ date, time }, ctx) {
    const { availability } = getAgendaDeps();
    const all = await availability.list();
    const matches = all.filter((s) => s.date === date && s.time === time);
    for (const m of matches) {
      await availability.delete(m.id);
    }
    await ctx.emit("agenda.availability.changed", {
      date,
      operation: "remove",
    });
    return ok({ success: true, date, time });
  },
});
