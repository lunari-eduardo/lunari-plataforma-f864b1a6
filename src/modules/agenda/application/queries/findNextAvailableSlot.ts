import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { err, ok } from "@/shared/result";
import { IsoDateSchema, TimeSchema } from "../../domain/types";
import { findNextFreeSlot } from "../../domain/conflict";
import { agendaError, AgendaErrorCodes } from "../../domain/errors";
import { getAgendaDeps } from "../../infrastructure/container";

const Input = z.object({
  fromDate: IsoDateSchema,
  fromTime: TimeSchema,
  horizonDays: z.number().int().positive().max(180).default(30),
});

const Output = z.object({ date: IsoDateSchema, time: TimeSchema });

export const findNextAvailableSlot = defineQuery({
  id: "agenda.availability.findNext",
  title: "Encontrar próximo slot livre",
  description:
    "Procura o próximo slot de disponibilidade sem conflito com agendamentos confirmados, a partir de uma data/hora.",
  input: Input,
  output: Output,
  permissions: ["agenda:read"],
  async handler(input) {
    const { appointments, availability } = getAgendaDeps();
    const horizon = input.horizonDays;

    // listar appointments + availability uma vez
    const slots = await availability.list();
    // pega janela ampla suficiente para o horizonte
    const end = horizonEnd(input.fromDate, horizon);
    const appts = await appointments.listByRange({ start: input.fromDate, end });

    const next = findNextFreeSlot(
      slots,
      appts,
      { date: input.fromDate, time: input.fromTime },
      horizon,
    );
    if (!next) {
      return err(
        agendaError(
          AgendaErrorCodes.NoSlotAvailable,
          "Nenhum slot disponível dentro do horizonte informado.",
        ),
      );
    }
    return ok(next);
  },
});

function horizonEnd(from: string, days: number): string {
  const [y, m, d] = from.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
