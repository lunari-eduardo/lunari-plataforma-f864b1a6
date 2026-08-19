import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { IsoDateSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  date: IsoDateSchema.describe("Data no formato YYYY-MM-DD para bloquear"),
  reason: z.string().optional().describe("Motivo do bloqueio (ex: 'Férias', 'Compromisso', 'Indisponível')"),
});

export const blockDate = defineCommand({
  id: "agenda.blockDate",
  title: "Bloquear dia na agenda",
  description:
    "Bloqueia um dia inteiro na agenda, marcando como indisponível e impedindo agendamentos para a data.",
  input: Input,
  output: z.object({ success: z.boolean(), date: z.string(), label: z.string() }),
  permissions: ["agenda:write"],
  sideEffects: ["db:availability_slots", "event:agenda.availability.changed"],
  audit: "on-success",
  async handler({ date, reason }, ctx) {
    const { availability } = getAgendaDeps();
    // Limpa slots prévios da data para evitar sobreposições
    await availability.clearForDate(date);
    const label = reason?.trim() || "Bloqueado";
    await availability.addMany([
      {
        date,
        time: "00:00",
        duration: 1440,
        typeId: "bloqueado",
        label,
        color: "#ef4444",
        isFullDay: true,
        fullDayDescription: label,
      },
    ]);
    await ctx.emit("agenda.availability.changed", {
      date,
      operation: "add",
    });
    return ok({ success: true, date, label });
  },
});
