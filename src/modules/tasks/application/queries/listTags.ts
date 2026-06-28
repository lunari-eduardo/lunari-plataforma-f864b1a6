import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseTagsRepo } from "../../infrastructure/supabase/tagsRepo";
import { resolveUserId } from "../_auth";

export const listTags = defineQuery({
  id: "tasks.tags.list",
  title: "Listar tags",
  description: "Lista todas as tags do usuário.",
  input: z.object({}),
  output: z.object({ tags: z.array(z.unknown()) }),
  permissions: ["tasks:read"],
  sideEffects: [],
  async handler(_input, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const tags = await supabaseTagsRepo.list(auth.value);
    return ok({ tags });
  },
});
