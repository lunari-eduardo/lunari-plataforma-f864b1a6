import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabasePeopleRepo } from "../../infrastructure/supabase/peopleRepo";
import { resolveUserId } from "../_auth";

export const listPeople = defineQuery({
  id: "tasks.people.list",
  title: "Listar pessoas",
  description: "Lista todas as pessoas atribuíveis a tarefas.",
  input: z.object({}),
  output: z.object({ people: z.array(z.unknown()) }),
  permissions: ["tasks:read"],
  sideEffects: [],
  async handler(_input, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const people = await supabasePeopleRepo.list(auth.value);
    return ok({ people });
  },
});
