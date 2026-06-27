import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseTasksRepo } from "../../infrastructure/supabase/tasksRepo";
import { supabaseStatusesRepo } from "../../infrastructure/supabase/statusesRepo";
import { byDueBucket, counters } from "../../domain/selectors";
import { isTerminalStatus } from "../../domain/rules";
import { resolveUserId } from "../_auth";

const Input = z.object({}).optional();
const Output = z.object({
  total: z.number(),
  open: z.number(),
  done: z.number(),
  overdue: z.number(),
  buckets: z.object({
    overdue: z.array(z.unknown()),
    today: z.array(z.unknown()),
    tomorrow: z.array(z.unknown()),
    week: z.array(z.unknown()),
    later: z.array(z.unknown()),
    none: z.array(z.unknown()),
  }),
});

/**
 * Snapshot temporal das tarefas — usado pela Lu para responder
 * "o que tenho pra hoje?", "estou atrasado em quê?" etc.
 */
export const dueOverview = defineQuery({
  id: "tasks.dueOverview",
  title: "Visão geral de prazos",
  description: "Conta e agrupa tarefas por bucket temporal (overdue, hoje, amanhã, semana).",
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
    const open = tasks.filter((t) => !isTerminalStatus(t.status, statuses));
    const buckets = byDueBucket(open);
    return ok({
      total: counters.total(tasks),
      open: counters.open(tasks, statuses),
      done: counters.done(tasks, statuses),
      overdue: counters.overdue(tasks, statuses),
      buckets,
    });
  },
});
