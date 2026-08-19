import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { ok } from "@/shared/result";
import { IsoDateSchema, TimeSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  clientName: z.string().min(1).describe("Nome do cliente"),
  clienteId: z.string().optional().describe("ID do cliente no CRM se existir"),
  date: IsoDateSchema.describe("Data da sessão no formato YYYY-MM-DD"),
  time: TimeSchema.describe("Horário de início no formato HH:mm"),
  durationMinutes: z.number().int().positive().optional().default(60).describe("Duração estimada da sessão em minutos"),
  type: z.string().optional().default("Sessão").describe("Tipo de ensaio (ex: 'Ensaio Gestante', 'Casamento', 'Família', 'Parto', 'Corporativo')"),
  packageId: z.string().optional().describe("ID do pacote se houver"),
  description: z.string().optional().describe("Observações da sessão"),
});

export const createSession = defineCommand({
  id: "agenda.createSession",
  title: "Agendar sessão fotográfica",
  description: "Cria um agendamento de sessão fotográfica na agenda, vinculando ao cliente e criando o fluxo de trabalho.",
  input: Input,
  output: z.object({ id: z.string(), title: z.string(), date: z.string(), time: z.string(), client: z.string() }),
  permissions: ["agenda:write"],
  sideEffects: ["db:appointments", "event:agenda.appointment.created"],
  audit: "on-success",
  async handler(input, ctx) {
    const { appointments } = getAgendaDeps();
    const duration = input.durationMinutes || 60;
    const sessionType = input.type?.trim() || "Sessão";
    const cleanClientName = input.clientName.trim();
    const title = `${cleanClientName} - ${sessionType}`;

    let clienteId = input.clienteId && input.clienteId.trim() !== "" ? input.clienteId.trim() : undefined;
    if (!clienteId && cleanClientName) {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: existing } = await supabase
          .from("clientes")
          .select("id")
          .ilike("nome", cleanClientName)
          .maybeSingle();
        if (existing?.id) {
          clienteId = existing.id;
        }
      } catch (err) {
        console.warn("⚠️ [createSession] Erro ao buscar cliente prévio:", err);
      }
    }

    const created = await appointments.create({
      title,
      client: cleanClientName,
      clienteId,
      date: input.date,
      time: input.time,
      type: sessionType,
      agendaType: "session",
      durationMinutes: duration,
      packageId: input.packageId && input.packageId.trim() !== "" ? input.packageId.trim() : undefined,
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
      client: created.client,
    });
  },
});
