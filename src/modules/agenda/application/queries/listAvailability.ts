import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { ok } from "@/shared/result";
import { AvailabilitySlotSchema } from "../../domain/types";
import { getAgendaDeps } from "../../infrastructure/container";

export const listAvailability = defineQuery({
  id: "agenda.availability.list",
  title: "Listar slots de disponibilidade",
  description: "Retorna todos os slots de disponibilidade cadastrados pelo usuário.",
  input: z.object({}).optional().default({}),
  output: z.array(AvailabilitySlotSchema),
  permissions: ["agenda:read"],
  async handler() {
    const { availability } = getAgendaDeps();
    return ok(await availability.list());
  },
});
