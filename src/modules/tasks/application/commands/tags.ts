/**
 * Capabilities de Task Tags — create/update/remove/reorder.
 */
import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTagsRepo } from "../../infrastructure/supabase/tagsRepo";
import { tagsStore } from "../../presentation/store/tagsStore";
import { resolveUserId } from "../_auth";

const TagOutput = z.object({ id: z.string(), name: z.string(), color: z.string().optional() });

export const createTag = defineCommand({
  id: "tasks.tags.create",
  title: "Criar tag",
  description: "Cria uma nova tag para tarefas.",
  input: z.object({ name: z.string().min(1).max(60), color: z.string().optional() }),
  output: TagOutput,
  permissions: ["tasks:write"],
  sideEffects: ["db:task_tags"],
  async handler(input, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      const order = tagsStore.getSnapshot().tags.length;
      const created = await supabaseTagsRepo.create({ ...input, order }, auth.value);
      return ok({ id: created.id, name: created.name, color: created.color });
    } catch (e) {
      ctx.log.error("falha ao criar tag", { e });
      return err(domainError("EXTERNAL", "Não foi possível criar a tag.", { cause: e, retriable: true }));
    }
  },
});

export const updateTag = defineCommand({
  id: "tasks.tags.update",
  title: "Atualizar tag",
  description: "Atualiza nome ou cor de uma tag.",
  input: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(60).optional(),
    color: z.string().optional(),
  }),
  output: z.object({ id: z.string() }),
  permissions: ["tasks:write"],
  sideEffects: ["db:task_tags"],
  async handler({ id, ...patch }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      await supabaseTagsRepo.update(id, patch, auth.value);
      return ok({ id });
    } catch (e) {
      ctx.log.error("falha ao atualizar tag", { e });
      return err(domainError("EXTERNAL", "Não foi possível atualizar a tag.", { cause: e, retriable: true }));
    }
  },
});

export const deleteTag = defineCommand({
  id: "tasks.tags.delete",
  title: "Excluir tag",
  description: "Remove uma tag.",
  input: z.object({ id: z.string().uuid() }),
  output: z.object({ id: z.string() }),
  permissions: ["tasks:write"],
  sideEffects: ["db:task_tags"],
  needsApproval: true,
  audit: "always",
  async handler({ id }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      await supabaseTagsRepo.remove(id, auth.value);
      return ok({ id });
    } catch (e) {
      ctx.log.error("falha ao excluir tag", { e });
      return err(domainError("EXTERNAL", "Não foi possível excluir a tag.", { cause: e, retriable: true }));
    }
  },
});

export const reorderTags = defineCommand({
  id: "tasks.tags.reorder",
  title: "Reordenar tags",
  description: "Atualiza a ordem de exibição das tags.",
  input: z.object({
    items: z.array(z.object({ id: z.string().uuid(), order: z.number().int().min(0) })).min(1),
  }),
  output: z.object({ ok: z.literal(true) }),
  permissions: ["tasks:write"],
  sideEffects: ["db:task_tags"],
  async handler({ items }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      await supabaseTagsRepo.reorder(items, auth.value);
      return ok({ ok: true as const });
    } catch (e) {
      ctx.log.error("falha ao reordenar tags", { e });
      return err(domainError("EXTERNAL", "Não foi possível reordenar as tags.", { cause: e, retriable: true }));
    }
  },
});
