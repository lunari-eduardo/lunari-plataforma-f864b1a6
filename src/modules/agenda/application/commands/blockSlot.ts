import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { IsoDateSchema, TimeSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  date: IsoDateSchema.describe("Data no formato YYYY-MM-DD"),
  time: TimeSchema.describe("Horário inicial no formato HH:mm"),
  durationMinutes: z.number().int().positive().optional().default(60).describe("Duração do bloqueio em minutos (padrão 60)"),
  reason: z.string().optional().describe("Motivo do bloqueio (opcional)"),
});

export const blockSlot = defineCommand({
  id: "agenda.blockSlot",
  title: "Bloquear horário específico",
  description: "Bloqueia um horário ou intervalo específico na agenda.",
  input: Input,
  output: z.object({ success: z.boolean(), date: z.string(), time: z.string() }),
  permissions: ["agenda:write"],
  sideEffects: ["db:availability_slots", "event:agenda.availability.changed"],
  audit: "on-success",
  async handler({ date, time, durationMinutes = 60, reason }, ctx) {
    const { availability } = getAgendaDeps();
    const label = reason?.trim() || "Bloqueado";
    await availability.addMany([
      {
        date,
        time,
        duration: durationMinutes,
        typeId: "bloqueado",
        label,
        color: "#ef4444",
        isFullDay: false,
      },
    ]);
    await ctx.emit("agenda.availability.changed", {
      date,
      operation: "add",
    });
    return ok({ success: true, date, time });
  },
});
