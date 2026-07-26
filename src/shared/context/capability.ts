/**
 * Capability: context.get — leitura tipada do Context Engine (Onda 4, ADR-003).
 * Audience: ui, lu, mcp — o Lu usa isso para ponderar respostas.
 *
 * NÃO grava nada. Escrita continua nas telas de Perfil / Configurações /
 * Admin; se um setter precisar existir aqui, criamos capability própria
 * (`context.set.*`) com permission dedicada.
 */
import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { ok } from "@/shared/result";
import { loadContext } from ".";

const FactSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  source: z.literal("human"),
  confidence: z.enum(["high", "medium", "low"]),
  updatedAt: z.string().optional(),
});

export const contextGetCapability = defineQuery({
  id: "context.get",
  title: "Ler contexto declarado",
  description:
    "Retorna os fatos declarados pelo fotógrafo (perfil, decisões de rollout, etc.). Somente leitura.",
  input: z.object({
    keys: z
      .array(z.string())
      .optional()
      .describe("Filtra por chaves específicas. Omitido = retorna tudo."),
  }),
  output: z.object({
    userId: z.string(),
    loadedAt: z.string(),
    facts: z.array(FactSchema),
  }),
  permissions: [],
  audience: ["ui", "lu", "mcp"],
  examples: [
    "Quem é o dono desta conta?",
    "Qual estágio de rollout do assistente está ativo?",
    "Qual a cidade cadastrada no perfil?",
  ],
  async handler({ keys }, ctx) {
    const userId = ctx.user?.id ?? "";
    const snapshot = await loadContext(userId);
    let facts = Object.values(snapshot.facts);
    if (keys && keys.length > 0) {
      const wanted = new Set(keys);
      facts = facts.filter((f) => wanted.has(f.key));
    }
    return ok({
      userId: snapshot.userId,
      loadedAt: snapshot.loadedAt,
      facts,
    });
  },
});
