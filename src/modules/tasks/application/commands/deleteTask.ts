import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { resolveUserId } from "../_auth";

const Input = z.object({ id: z.string().uuid() });
const Output = z.object({ id: z.string() });

export const deleteTask = defineCommand({
  id: "tasks.delete",
  title: "Excluir tarefa",
  description: "Remove uma tarefa permanentemente. Requer aprovação humana quando executado pela IA.",
  input: Input,
  output: Output,
  permissions: ["tasks:write"],
  sideEffects: ["db:tasks", "event:tasks.deleted"],
  needsApproval: true,
  audit: "always",
  async handler({ id }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;

    try {
      await supabaseTasksRepo.remove(id, userId);
      await ctx.emit("tasks.deleted", { id, photographerId: userId });
      return ok({ id });
    } catch (e) {
      ctx.log.error("falha ao excluir tarefa", { e });
      return err(domainError("EXTERNAL", "Não foi possível excluir a tarefa.", { cause: e, retriable: true }));
    }
  },
});
