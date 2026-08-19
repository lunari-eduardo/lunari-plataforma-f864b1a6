import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { IsoDateSchema, TimeSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  title: z.string().min(1).describe("Assunto da reunião (ex: 'Briefing de Ensaio', 'Apresentação de Fotos', 'Alinhamento com Noivos')"),
  date: IsoDateSchema.describe("Data no formato YYYY-MM-DD"),
  time: TimeSchema.describe("Horário de início no formato HH:mm (ex: '15:00')"),
  durationMinutes: z.number().int().positive().optional().default(60).describe("Duração estimada em minutos (padrão: 60)"),
  clientName: z.string().optional().describe("Nome do cliente ou participante"),
  clienteId: z.string().optional().describe("ID do cliente no CRM se existir"),
  location: z.string().optional().describe("Local ou link da reunião (ex: 'Google Meet', 'Estúdio', 'Zoom')"),
  description: z.string().optional().describe("Pauta ou tópicos a discutir"),
});

export const createMeeting = defineCommand({
  id: "agenda.createMeeting",
  title: "Agendar reunião",
  description: "Cria uma reunião na agenda com cliente, pauta, link/local e duração definidos.",
  input: Input,
  output: z.object({ id: z.string(), title: z.string(), date: z.string(), time: z.string(), durationMinutes: z.number(), client: z.string() }),
  permissions: ["agenda:write"],
  sideEffects: ["db:appointments", "event:agenda.appointment.created"],
  audit: "on-success",
  async handler(input, ctx) {
    const { appointments } = getAgendaDeps();
    const duration = input.durationMinutes || 60;
    const client = input.clientName?.trim() || input.title.trim();
    const created = await appointments.create({
      title: input.title.trim(),
      client,
      clienteId: input.clienteId,
      date: input.date,
      time: input.time,
      type: "reunião",
      agendaType: "meeting",
      durationMinutes: duration,
      location: input.location?.trim() || undefined,
      status: "confirmado",
      description: input.description?.trim() || undefined,
    });
    await ctx.emit("agenda.appointment.created", {
      appointmentId: created.id,
      clienteId: created.clienteId,
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
      client,
    });
  },
});
