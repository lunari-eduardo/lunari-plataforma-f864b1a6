import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { supabaseStatusesRepo } from "../../infrastructure/supabase/statusesRepo";
import { findDefaultOpenStatus, isTerminalStatus } from "../../domain/rules";
import { resolveUserId } from "../_auth";

const Input = z.object({ id: z.string().uuid(), toStatus: z.string().optional() });
const Output = z.object({ id: z.string(), status: z.string() });

export const reopenTask = defineCommand({
  id: "tasks.reopen",
  title: "Reabrir tarefa",
  description: "Reabre uma tarefa concluída, limpando completed_at.",
  input: Input,
  output: Output,
  permissions: ["tasks:write"],
  sideEffects: ["db:tasks", "event:tasks.reopened", "event:tasks.moved"],
  audit: "on-success",
  async handler({ id, toStatus }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;

    try {
      const current = await supabaseTasksRepo.getById(id, userId);
      if (!current) return err(domainError("NOT_FOUND", "Tarefa não encontrada."));

      const statuses = await supabaseStatusesRepo.list(userId);
      const checkedPatch = current.type === "checklist" ? { checked: false } : {};

      if (!isTerminalStatus(current.status, statuses)) {
        if (current.type === "checklist" && current.checked === true) {
          await supabaseTasksRepo.update(id, checkedPatch, userId);
        }
        return ok({ id, status: current.status });
      }

      const target =
        toStatus ?? findDefaultOpenStatus(statuses)?.key ?? "todo";

      await supabaseTasksRepo.update(
        id,
        { status: target, completedAt: undefined, ...checkedPatch },
        userId,
      );

      await ctx.emit("tasks.moved", { id, from: current.status, to: target, photographerId: userId });
      await ctx.emit("tasks.reopened", { id, photographerId: userId });
      return ok({ id, status: target });
    } catch (e) {
      ctx.log.error("falha ao reabrir tarefa", { e });
      return err(domainError("EXTERNAL", "Não foi possível reabrir a tarefa.", { cause: e, retriable: true }));
    }
  },
});
