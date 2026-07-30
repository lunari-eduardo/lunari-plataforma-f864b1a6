import { zodToJsonSchema } from "zod-to-json-schema";
import type { Capability } from "./types";
import type { CapabilityAudience } from "./audience";
import { serializeExecution, type SerializedExecution } from "./execution";

/**
 * Converte uma capability num descritor serializável para o AI SDK / MCP.
 *
 * O input/output das capabilities é um Zod schema. Aqui convertemos para
 * JSON Schema (draft-07 / OpenAPI-friendly) que é o formato exigido pelos
 * clientes MCP (ChatGPT, Claude, Cursor) e pelos providers LLM
 * (OpenAI function calling, Gemini function declarations).
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
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  costHint: string;
  examples: Array<{ nl: string; input: unknown; output?: unknown }>;
  /** Metadados para a UI de confirmação (só em capabilities com approval). */
  confirmation?: ConfirmationChallenge;
  /** A2 — transporte declarado (rpc/edge/client-only). */
  execution: SerializedExecution;
  /** Superfícies que enxergam esta capability. */
  audience: readonly CapabilityAudience[];
}


const EMPTY_OBJECT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

function convertSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return { ...EMPTY_OBJECT_SCHEMA };
  try {
    const json = zodToJsonSchema(schema as never, {
      target: "openApi3",
      $refStrategy: "none",
    }) as Record<string, unknown>;

    // Remove metadados que MCP/OpenAI/Gemini não consomem.
    delete json.$schema;
    delete (json as { definitions?: unknown }).definitions;

    // Garante que a raiz seja um objeto — MCP e Gemini function calling exigem.
    if (json.type !== "object") {
      return { type: "object", properties: { value: json }, additionalProperties: false };
    }
    if (!("properties" in json)) {
      (json as { properties: unknown }).properties = {};
    }
    if (!("additionalProperties" in json)) {
      (json as { additionalProperties: unknown }).additionalProperties = false;
    }
    return json;
  } catch {
    return { ...EMPTY_OBJECT_SCHEMA };
  }
}

export function capabilityToAITool(cap: Capability): AICapabilityTool {
  return {
    id: cap.id,
    kind: cap.kind,
    description: `${cap.title}. ${cap.description}`,
    inputSchema: convertSchema(cap.input),
    outputSchema: convertSchema(cap.output),
    costHint: cap.costHint,
    examples: cap.examples,
    execution: serializeExecution(cap.execution),
    audience: cap.audience,
  };
}

