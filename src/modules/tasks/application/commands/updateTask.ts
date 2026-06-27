import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { resolveUserId } from "../_auth";

const Patch = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  type: z.enum(["simple", "content", "checklist", "document"]).optional(),
  status: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  assigneeName: z.string().nullable().optional(),
  notes: z.string().optional(),
  estimatedHours: z.number().nonnegative().optional(),
  callToAction: z.string().optional(),
  socialPlatforms: z.array(z.string()).optional(),
  relatedClienteId: z.string().uuid().nullable().optional(),
  relatedSessionId: z.string().uuid().nullable().optional(),
  activeSections: z.array(z.enum(["basic", "checklist", "content", "document"])).optional(),
  checklistItems: z.array(z.any()).optional(),
  attachments: z.array(z.any()).optional(),
  captions: z.array(z.any()).optional(),
});

const Input = z.object({
  id: z.string().uuid(),
  patch: Patch.refine((p) => Object.keys(p).length > 0, "patch vazio"),
});

const Output = z.object({ id: z.string(), changedKeys: z.array(z.string()) });

export const updateTask = defineCommand({
  id: "tasks.update",
  title: "Atualizar tarefa",
  description: "Atualiza campos editáveis de uma tarefa. Status, assignee, snooze têm comandos próprios.",
  input: Input,
  output: Output,
  permissions: ["tasks:write"],
  sideEffects: ["db:tasks", "event:tasks.updated"],
  audit: "on-success",
  async handler({ id, patch }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;

    try {
      const normalized = Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, v === null ? undefined : v]),
      );
      await supabaseTasksRepo.update(id, normalized, userId);
      const changedKeys = Object.keys(patch);
      await ctx.emit("tasks.updated", { id, changedKeys, photographerId: userId });
      return ok({ id, changedKeys });
    } catch (e) {
      ctx.log.error("falha ao atualizar tarefa", { e });
      return err(domainError("EXTERNAL", "Não foi possível atualizar a tarefa.", { cause: e, retriable: true }));
    }
  },
});
