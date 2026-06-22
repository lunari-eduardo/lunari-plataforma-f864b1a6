import { zodToJsonSchema } from "zod-to-json-schema";
import type { Capability } from "./types";

/**
 * Converte uma capability no formato esperado pelo AI SDK (tool() do `ai`).
 * Aqui retornamos um objeto serializável; o módulo `ai/` de cada feature
 * adapta para o formato concreto da versão do AI SDK em uso.
 */
export interface AICapabilityTool {
  id: string;
  kind: "command" | "query";
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
  needsApproval: boolean;
  costHint: string;
  examples: Array<{ nl: string; input: unknown; output?: unknown }>;
}

export function capabilityToAITool(cap: Capability): AICapabilityTool {
  return {
    id: cap.id,
    kind: cap.kind,
    description: `${cap.title}. ${cap.description}`,
    inputSchema: zodToJsonSchema(cap.input, { target: "openApi3" }),
    outputSchema: zodToJsonSchema(cap.output, { target: "openApi3" }),
    needsApproval: cap.needsApproval({ input: undefined as never, user: null }),
    costHint: cap.costHint,
    examples: cap.examples,
  };
}
