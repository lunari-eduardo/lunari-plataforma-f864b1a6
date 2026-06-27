import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { resolveUserId } from "../_auth";

const Input = z.object({
  id: z.string().uuid(),
  until: z.string().datetime(),
});
const Output = z.object({ id: z.string(), until: z.string() });

export const snoozeTask = defineCommand({
  id: "tasks.snooze",
  title: "Adiar tarefa",
  description: "Posterga as notificações da tarefa até a data informada.",
  input: Input,
  output: Output,
  permissions: ["tasks:write"],
  sideEffects: ["db:tasks", "event:tasks.snoozed"],
  audit: "on-success",
  async handler({ id, until }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;

    try {
      await supabaseTasksRepo.update(id, { snoozeUntil: until }, userId);
      await ctx.emit("tasks.snoozed", { id, until, photographerId: userId });
      return ok({ id, until });
    } catch (e) {
      ctx.log.error("falha ao adiar tarefa", { e });
      return err(domainError("EXTERNAL", "Não foi possível adiar a tarefa.", { cause: e, retriable: true }));
    }
  },
});
