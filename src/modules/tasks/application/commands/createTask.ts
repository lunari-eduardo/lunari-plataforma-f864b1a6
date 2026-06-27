import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { resolveUserId } from "../_auth";

const Input = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  type: z.enum(["simple", "content", "checklist", "document"]).default("simple"),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().uuid().optional(),
  assigneeName: z.string().optional(),
  tags: z.array(z.string()).optional(),
  relatedClienteId: z.string().uuid().optional(),
  relatedSessionId: z.string().uuid().optional(),
  source: z.enum(["user", "automation", "ai"]).default("user"),
});

const Output = z.object({ id: z.string(), status: z.string() });

export const createTask = defineCommand({
  id: "tasks.create",
  title: "Criar tarefa",
  description: "Cria uma nova tarefa no quadro do usuário autenticado.",
  input: Input,
  output: Output,
  permissions: ["tasks:write"],
  sideEffects: ["db:tasks", "event:tasks.created"],
  audit: "on-success",
  examples: [
    {
      nl: "Crie uma tarefa para revisar o contrato amanhã, prioridade alta",
      input: { title: "Revisar contrato", priority: "high", type: "simple", source: "user" },
    },
  ],
  async handler(input, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;

    try {
      const created = await supabaseTasksRepo.create(
        {
          title: input.title,
          description: input.description,
          status: input.status ?? "todo",
          priority: input.priority,
          type: input.type,
          source: input.source === "user" ? "manual" : input.source,
          createdAt: new Date().toISOString(),
          dueDate: input.dueDate,
          assigneeId: input.assigneeId,
          assigneeName: input.assigneeName,
          tags: input.tags,
          relatedClienteId: input.relatedClienteId,
          relatedSessionId: input.relatedSessionId,
        },
        userId,
      );

      await ctx.emit("tasks.created", {
        id: created.id,
        title: created.title,
        status: created.status,
        photographerId: userId,
        source: input.source,
      });

      return ok({ id: created.id, status: created.status });
    } catch (e) {
      ctx.log.error("falha ao criar tarefa", { e });
      return err(domainError("EXTERNAL", "Não foi possível criar a tarefa.", { cause: e, retriable: true }));
    }
  },
});
