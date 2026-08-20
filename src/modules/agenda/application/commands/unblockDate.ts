import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { IsoDateSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  date: IsoDateSchema.describe("Data no formato YYYY-MM-DD para desbloquear"),
});

export const unblockDate = defineCommand({
  id: "agenda.unblockDate",
  title: "Desbloquear dia na agenda",
  description: "Remove o bloqueio de um dia na agenda, liberando a data para agendamentos.",
  input: Input,
  output: z.object({ success: z.boolean(), date: z.string() }),
  permissions: ["agenda:write"],
  sideEffects: ["db:availability_slots", "event:agenda.availability.changed"],
  audit: "on-success",
  async handler({ date }, ctx) {
    const { availability } = getAgendaDeps();
    await availability.clearForDate(date);
    await ctx.emit("agenda.availability.changed", {
      date,
      operation: "delete" as any,
    });
    return ok({ success: true, date });
  },
});
