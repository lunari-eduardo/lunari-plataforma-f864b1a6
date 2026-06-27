import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { resolveUserId } from "../_auth";

const Input = z.object({ limit: z.number().int().min(1).max(500).optional() });
const Output = z.object({
  tasks: z.array(z.unknown()),
  total: z.number(),
});

export const listTasks = defineQuery({
  id: "tasks.list",
  title: "Listar tarefas",
  description: "Lista todas as tarefas do usuário, mais recentes primeiro.",
  input: Input,
  output: Output,
  permissions: ["tasks:read"],
  sideEffects: [],
  async handler({ limit }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const tasks = await supabaseTasksRepo.list({ userId: auth.value, limit });
    return ok({ tasks, total: tasks.length });
  },
});
