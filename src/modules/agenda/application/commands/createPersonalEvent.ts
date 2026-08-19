import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { IsoDateSchema, TimeSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  title: z.string().min(1).describe("Título do evento pessoal (ex: 'Consulta Médica', 'Dentista', 'Academia', 'Treinamento')"),
  date: IsoDateSchema.describe("Data no formato YYYY-MM-DD"),
  time: TimeSchema.describe("Horário de início no formato HH:mm (ex: '14:00')"),
  durationMinutes: z.number().int().positive().optional().default(60).describe("Duração estimada em minutos (padrão: 60)"),
  description: z.string().optional().describe("Observações, endereço ou detalhes adicionais"),
});

export const createPersonalEvent = defineCommand({
  id: "agenda.createPersonalEvent",
  title: "Criar evento pessoal",
  description: "Cria um compromisso pessoal na agenda (médico, treino, viagem, pessoal, etc.) com duração e horário definidos.",
  input: Input,
  output: z.object({ id: z.string(), title: z.string(), date: z.string(), time: z.string(), durationMinutes: z.number() }),
  permissions: ["agenda:write"],
  sideEffects: ["db:appointments", "event:agenda.appointment.created"],
  audit: "on-success",
  async handler(input, ctx) {
    const { appointments } = getAgendaDeps();
    const duration = input.durationMinutes || 60;
    const created = await appointments.create({
      title: input.title.trim(),
      client: input.title.trim(),
      date: input.date,
      time: input.time,
      type: "pessoal",
      agendaType: "personal",
      durationMinutes: duration,
      status: "confirmado",
      description: input.description?.trim() || undefined,
    });
    await ctx.emit("agenda.appointment.created", {
      appointmentId: created.id,
      date: created.date,
      time: created.time,
      status: "confirmado",
    });
    return ok({
      id: created.id,
      title: created.title,
      date: created.date,
      time: created.time,
      durationMinutes: duration,
    });
  },
});
