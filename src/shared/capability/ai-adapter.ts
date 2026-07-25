import type { Capability } from "./types";

/**
 * Converte uma capability num descritor serializável que o módulo `ai/` de cada
 * feature adapta ao formato concreto do AI SDK em uso. Mantemos um conversor
 * mínimo de Zod → JSON Schema interno para evitar dependência extra. Para
 * schemas complexos, cada módulo pode plugar um conversor mais completo.
 */
export type ConfirmationKind = "destructive" | "send" | "publish" | "ai_generation";

export interface ConfirmationChallenge {
  /** UI decide como cobrar (input digitado, wake-word por voz, etc.). */
  kind: ConfirmationKind;
  /** Instrução textual curta para exibir ao usuário. */
  prompt: string;
  /** Desafio "type-name" opcional: usuário deve digitar exatamente `expected`. */
  challenge?: { type: "type_name"; expected: string };
}

export interface AICapabilityTool {
  id: string;
  kind: "command" | "query";
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
  costHint: string;
  examples: Array<{ nl: string; input: unknown; output?: unknown }>;
  /** Metadados para a UI de confirmação (só em capabilities com approval). */
  confirmation?: ConfirmationChallenge;
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
