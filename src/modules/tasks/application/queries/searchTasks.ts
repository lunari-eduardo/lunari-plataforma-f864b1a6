import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { search as searchSelector } from "../../domain/selectors";
import { resolveUserId } from "../_auth";

const Input = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});
const Output = z.object({ tasks: z.array(z.unknown()), total: z.number() });

export const searchTasks = defineQuery({
  id: "tasks.search",
  title: "Buscar tarefas",
  description: "Busca tarefas por título, descrição ou tag.",
  input: Input,
  output: Output,
  permissions: ["tasks:read"],
  sideEffects: [],
  async handler({ query, limit }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const all = await supabaseTasksRepo.list({ userId: auth.value });
    const found = searchSelector(all, query).slice(0, limit ?? 50);
    return ok({ tasks: found, total: found.length });
  },
});
