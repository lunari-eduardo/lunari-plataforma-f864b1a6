import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { err, ok } from "@/shared/result";
import { AppointmentSchema } from "../../domain/types";
import { agendaError, AgendaErrorCodes } from "../../domain/errors";
import { getAgendaDeps } from "../../infrastructure/container";

export const getAppointmentById = defineQuery({
  id: "agenda.appointments.get",
  title: "Obter agendamento por ID",
  description: "Busca um agendamento específico do usuário pelo seu ID.",
  input: z.object({ id: z.string().min(1) }),
  output: AppointmentSchema,
  permissions: ["agenda:read"],
  async handler({ id }) {
    const { appointments } = getAgendaDeps();
    const row = await appointments.getById(id);
    if (!row) {
      return err(
        agendaError(
          AgendaErrorCodes.AppointmentNotFound,
          "Agendamento não encontrado.",
          { id },
        ),
      );
    }
    return ok(row);
  },
});
