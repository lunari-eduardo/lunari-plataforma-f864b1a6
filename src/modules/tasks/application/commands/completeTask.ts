import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { supabaseStatusesRepo } from "../../infrastructure/supabase/statusesRepo";
import { findTerminalStatus, isTerminalStatus } from "../../domain/rules";
import { resolveUserId } from "../_auth";

const Input = z.object({ id: z.string().uuid() });
const Output = z.object({ id: z.string(), completedAt: z.string() });

export const completeTask = defineCommand({
  id: "tasks.complete",
  title: "Concluir tarefa",
  description: "Marca a tarefa como concluída usando o status terminal configurado.",
  input: Input,
  output: Output,
  permissions: ["tasks:write"],
  sideEffects: ["db:tasks", "event:tasks.completed", "event:tasks.moved"],
  audit: "on-success",
  idempotencyKey: (i) => `tasks.complete:${i.id}`,
  async handler({ id }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;

    try {
      const current = await supabaseTasksRepo.getById(id, userId);
      if (!current) return err(domainError("NOT_FOUND", "Tarefa não encontrada."));

      const statuses = await supabaseStatusesRepo.list(userId);
      const terminal = findTerminalStatus(statuses);
      const targetKey = terminal?.key ?? "done";
      const completedAt = current.completedAt ?? new Date().toISOString();

      if (isTerminalStatus(current.status, statuses)) {
        return ok({ id, completedAt });
      }

      await supabaseTasksRepo.update(id, { status: targetKey, completedAt }, userId);
      await ctx.emit("tasks.moved", { id, from: current.status, to: targetKey, photographerId: userId });
      await ctx.emit("tasks.completed", { id, completedAt, photographerId: userId });
      return ok({ id, completedAt });
    } catch (e) {
      ctx.log.error("falha ao concluir tarefa", { e });
      return err(domainError("EXTERNAL", "Não foi possível concluir a tarefa.", { cause: e, retriable: true }));
    }
  },
});
