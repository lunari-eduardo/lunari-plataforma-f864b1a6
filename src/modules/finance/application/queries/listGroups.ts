import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { ok } from "@/shared/result";
import { GROUP_LIST, getGroupsByNature } from "../../domain/group";
import type { NatureCode } from "../../domain/nature";

const Input = z.object({
  natureCode: z.string().optional(),
}).strict();

const GroupOut = z.object({
  code: z.string(),
  natureCode: z.string(),
  label: z.string(),
  icon: z.string(),
  ordering: z.number(),
});
const Output = z.object({ groups: z.array(GroupOut), total: z.number() });

export const listGroups = defineQuery({
  id: "finance.group.list",
  title: "Listar grupos financeiros",
  description:
    "Catálogo fixo de grupos. Cada grupo pertence a uma natureza. Pode filtrar por `natureCode`.",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  sideEffects: [],
  async handler({ natureCode }) {
    const groups = natureCode
      ? getGroupsByNature(natureCode as NatureCode)
      : GROUP_LIST;
    return ok({ groups, total: groups.length });
  },
});
