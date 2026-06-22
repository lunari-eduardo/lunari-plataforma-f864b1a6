import type { Capability } from "./types";

/**
 * Converte uma capability num descritor serializável que o módulo `ai/` de cada
 * feature adapta ao formato concreto do AI SDK em uso. Mantemos um conversor
 * mínimo de Zod → JSON Schema interno para evitar dependência extra. Para
 * schemas complexos, cada módulo pode plugar um conversor mais completo.
 */
export interface AICapabilityTool {
  id: string;
  kind: "command" | "query";
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
  costHint: string;
  examples: Array<{ nl: string; input: unknown; output?: unknown }>;
}

function zodToJson(schema: unknown): unknown {
  // Placeholder — substituir por @valibot/to-json-schema ou zod-to-json-schema
  // quando o módulo AI for plugado. Por ora retornamos um marcador opaco.
  const s = schema as { _def?: { typeName?: string } };
  return { $zod: s?._def?.typeName ?? "unknown" };
}

export function capabilityToAITool(cap: Capability): AICapabilityTool {
  return {
    id: cap.id,
    kind: cap.kind,
    description: `${cap.title}. ${cap.description}`,
    inputSchema: zodToJson(cap.input),
    outputSchema: zodToJson(cap.output),
    costHint: cap.costHint,
    examples: cap.examples,
  };
}
