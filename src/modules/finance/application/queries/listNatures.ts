import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { ok } from "@/shared/result";
import { NATURE_LIST } from "../../domain/nature";

const Input = z.object({}).strict();
const NatureOut = z.object({
  code: z.string(),
  label: z.string(),
  sign: z.enum(["credit", "debit", "neutral"]),
  affectsPnL: z.boolean(),
  ordering: z.number(),
});
const Output = z.object({ natures: z.array(NatureOut), total: z.number() });

export const listNatures = defineQuery({
  id: "finance.nature.list",
  title: "Listar naturezas financeiras (interno)",
  description:
    "Catálogo fixo de naturezas financeiras. Uso interno (KPI, relatórios, IA). NÃO exibir ao usuário final.",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  sideEffects: [],
  async handler() {
    return ok({ natures: NATURE_LIST, total: NATURE_LIST.length });
  },
});
