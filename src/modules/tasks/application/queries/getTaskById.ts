import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { resolveUserId } from "../_auth";

const Input = z.object({ id: z.string().uuid() });
const Output = z.object({ task: z.unknown() });

export const getTaskById = defineQuery({
  id: "tasks.getById",
  title: "Detalhar tarefa",
  description: "Retorna uma tarefa pelo ID.",
  input: Input,
  output: Output,
  permissions: ["tasks:read"],
  sideEffects: [],
  async handler({ id }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const task = await supabaseTasksRepo.getById(id, auth.value);
    if (!task) return err(domainError("NOT_FOUND", "Tarefa não encontrada."));
    return ok({ task });
  },
});
