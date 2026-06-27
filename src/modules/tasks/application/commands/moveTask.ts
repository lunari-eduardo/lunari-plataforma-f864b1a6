import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { supabaseStatusesRepo } from "../../infrastructure/supabase/statusesRepo";
import { isTerminalStatus } from "../../domain/rules";
import { resolveUserId } from "../_auth";

const Input = z.object({
  id: z.string().uuid(),
  toStatus: z.string().min(1),
});

const Output = z.object({
  id: z.string(),
  fromStatus: z.string(),
  toStatus: z.string(),
  completedAt: z.string().nullable(),
});

/**
 * Move a tarefa entre status do Kanban. Resolve `completed_at` baseado no
 * `is_terminal` do `task_statuses` (substitui o hardcode `=== 'done'`).
 */
export const moveTask = defineCommand({
  id: "tasks.move",
  title: "Mover tarefa de status",
  description: "Altera o status (coluna do Kanban) da tarefa. Recalcula completed_at quando aplicável.",
  input: Input,
  output: Output,
  permissions: ["tasks:write"],
  sideEffects: ["db:tasks", "event:tasks.moved", "event:tasks.completed", "event:tasks.reopened"],
  audit: "on-success",
  idempotencyKey: (i) => `tasks.move:${i.id}:${i.toStatus}`,
  async handler({ id, toStatus }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;

    try {
      const current = await supabaseTasksRepo.getById(id, userId);
      if (!current) return err(domainError("NOT_FOUND", "Tarefa não encontrada."));
      const fromStatus = current.status;
      if (fromStatus === toStatus) {
        return ok({ id, fromStatus, toStatus, completedAt: current.completedAt ?? null });
      }

      const statuses = await supabaseStatusesRepo.list(userId);
      const wasDone = isTerminalStatus(fromStatus, statuses);
      const willBeDone = isTerminalStatus(toStatus, statuses);

      const patch: { status: string; completedAt?: string } = { status: toStatus };
      if (willBeDone && !wasDone) patch.completedAt = new Date().toISOString();
      if (!willBeDone && wasDone) (patch as { completedAt?: string | null }).completedAt = null as unknown as string;

      const updated = await supabaseTasksRepo.update(id, patch, userId);

      await ctx.emit("tasks.moved", { id, from: fromStatus, to: toStatus, photographerId: userId });
      if (willBeDone && !wasDone) {
        await ctx.emit("tasks.completed", {
          id,
          completedAt: updated.completedAt ?? new Date().toISOString(),
          photographerId: userId,
        });
      } else if (!willBeDone && wasDone) {
        await ctx.emit("tasks.reopened", { id, photographerId: userId });
      }

      return ok({ id, fromStatus, toStatus, completedAt: updated.completedAt ?? null });
    } catch (e) {
      ctx.log.error("falha ao mover tarefa", { e });
      return err(domainError("EXTERNAL", "Não foi possível mover a tarefa.", { cause: e, retriable: true }));
    }
  },
});
