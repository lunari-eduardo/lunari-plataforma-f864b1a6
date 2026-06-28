/**
 * Capabilities de Task People — create/update/remove/reorder.
 */
import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabasePeopleRepo } from "../../infrastructure/supabase/peopleRepo";
import { peopleStore } from "../../presentation/store/peopleStore";
import { resolveUserId } from "../_auth";

const PersonOutput = z.object({ id: z.string(), name: z.string(), color: z.string().optional() });

export const createPerson = defineCommand({
  id: "tasks.people.create",
  title: "Adicionar pessoa",
  description: "Adiciona uma nova pessoa atribuível a tarefas.",
  input: z.object({ name: z.string().min(1).max(80), color: z.string().optional() }),
  output: PersonOutput,
  permissions: ["tasks:write"],
  sideEffects: ["db:task_people"],
  async handler(input, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      const order = peopleStore.getSnapshot().people.length;
      const created = await supabasePeopleRepo.create({ name: input.name, color: input.color, order }, auth.value);
      return ok({ id: created.id, name: created.name, color: created.color });
    } catch (e) {
      ctx.log.error("falha ao criar pessoa", { e });
      return err(domainError("EXTERNAL", "Não foi possível adicionar a pessoa.", { cause: e, retriable: true }));
    }
  },
});

export const updatePerson = defineCommand({
  id: "tasks.people.update",
  title: "Atualizar pessoa",
  description: "Atualiza nome ou cor de uma pessoa.",
  input: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(80).optional(),
    color: z.string().optional(),
  }),
  output: z.object({ id: z.string() }),
  permissions: ["tasks:write"],
  sideEffects: ["db:task_people"],
  async handler({ id, ...patch }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      await supabasePeopleRepo.update(id, patch, auth.value);
      return ok({ id });
    } catch (e) {
      ctx.log.error("falha ao atualizar pessoa", { e });
      return err(domainError("EXTERNAL", "Não foi possível atualizar a pessoa.", { cause: e, retriable: true }));
    }
  },
});

export const deletePerson = defineCommand({
  id: "tasks.people.delete",
  title: "Excluir pessoa",
  description: "Remove uma pessoa do cadastro.",
  input: z.object({ id: z.string().uuid() }),
  output: z.object({ id: z.string() }),
  permissions: ["tasks:write"],
  sideEffects: ["db:task_people"],
  needsApproval: true,
  audit: "always",
  async handler({ id }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      await supabasePeopleRepo.remove(id, auth.value);
      return ok({ id });
    } catch (e) {
      ctx.log.error("falha ao excluir pessoa", { e });
      return err(domainError("EXTERNAL", "Não foi possível excluir a pessoa.", { cause: e, retriable: true }));
    }
  },
});

export const reorderPeople = defineCommand({
  id: "tasks.people.reorder",
  title: "Reordenar pessoas",
  description: "Atualiza a ordem de exibição das pessoas.",
  input: z.object({
    items: z.array(z.object({ id: z.string().uuid(), order: z.number().int().min(0) })).min(1),
  }),
  output: z.object({ ok: z.literal(true) }),
  permissions: ["tasks:write"],
  sideEffects: ["db:task_people"],
  async handler({ items }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      await supabasePeopleRepo.reorder(items as Array<{ id: string; order: number }>, auth.value);
      return ok({ ok: true as const });
    } catch (e) {
      ctx.log.error("falha ao reordenar pessoas", { e });
      return err(domainError("EXTERNAL", "Não foi possível reordenar as pessoas.", { cause: e, retriable: true }));
    }
  },
});
