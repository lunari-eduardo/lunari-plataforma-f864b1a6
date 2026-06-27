import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { supabaseStatusesRepo } from "../../infrastructure/supabase/statusesRepo";
import { countsByStatus as countsByStatusSelector } from "../../domain/selectors";
import { resolveUserId } from "../_auth";

const Input = z.object({}).optional();
const Output = z.object({
  counts: z.record(z.string(), z.number()),
  statuses: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      color: z.string().optional(),
      order: z.number().optional(),
      isTerminal: z.boolean().optional(),
    }),
  ),
});

export const countsByStatusQuery = defineQuery({
  id: "tasks.countsByStatus",
  title: "Contagem por status",
  description: "Retorna a quantidade de tarefas em cada coluna do Kanban.",
  input: Input,
  output: Output,
  permissions: ["tasks:read"],
  sideEffects: [],
  async handler(_input, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;
    const [tasks, statuses] = await Promise.all([
      supabaseTasksRepo.list({ userId }),
      supabaseStatusesRepo.list(userId),
    ]);
    const counts = countsByStatusSelector(tasks, statuses);
    return ok({ counts, statuses });
  },
});
