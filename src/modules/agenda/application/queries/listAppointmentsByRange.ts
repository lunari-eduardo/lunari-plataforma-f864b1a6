import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { ok } from "@/shared/result";
import { AppointmentSchema, DateRangeSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

export const listAppointmentsByRange = defineQuery({
  id: "agenda.appointments.list",
  title: "Listar agendamentos por período",
  description:
    "Retorna todos os agendamentos do usuário entre duas datas (inclusive). Use para alimentar visualizações de calendário e responder perguntas como 'quais sessões tenho em julho?'.",
  input: DateRangeSchema,
  output: z.array(AppointmentSchema),
  permissions: ["agenda:read"],
  costHint: "cheap",
  examples: [
    {
      nl: "Liste meus agendamentos da semana de 7 a 13 de julho",
      input: { start: "2026-07-07", end: "2026-07-13" },
    },
  ],
  async handler(input) {
    const { appointments } = getAgendaDeps();
    const rows = await appointments.listByRange(input);
    return ok(rows);
  },
});
