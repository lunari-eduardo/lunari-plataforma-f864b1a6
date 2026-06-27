import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { resolveUserId } from "../_auth";

const Input = z.object({
  id: z.string().uuid(),
  assigneeId: z.string().uuid().nullable().optional(),
  assigneeName: z.string().nullable().optional(),
});
const Output = z.object({
  id: z.string(),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
});

export const assignTask = defineCommand({
  id: "tasks.assign",
  title: "Atribuir tarefa",
  description: "Define ou remove o responsável de uma tarefa.",
  input: Input,
  output: Output,
  permissions: ["tasks:write"],
  sideEffects: ["db:tasks", "event:tasks.assigned"],
  audit: "on-success",
  async handler({ id, assigneeId, assigneeName }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;

    try {
      await supabaseTasksRepo.update(
        id,
        {
          assigneeId: assigneeId ?? undefined,
          assigneeName: assigneeName ?? undefined,
        },
        userId,
      );
      const aId = assigneeId ?? null;
      const aName = assigneeName ?? null;
      await ctx.emit("tasks.assigned", {
        id,
        assigneeId: aId,
        assigneeName: aName,
        photographerId: userId,
      });
      return ok({ id, assigneeId: aId, assigneeName: aName });
    } catch (e) {
      ctx.log.error("falha ao atribuir tarefa", { e });
      return err(domainError("EXTERNAL", "Não foi possível atribuir a tarefa.", { cause: e, retriable: true }));
    }
  },
});
