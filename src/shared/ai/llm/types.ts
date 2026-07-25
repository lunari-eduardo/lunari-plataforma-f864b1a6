/**
 * LLMProvider — abstração provider-agnostic para o Assistente Lu.
 *
 * Fase B (Onda R prep). NÃO acopla o runtime a Gemini, OpenAI ou qualquer
 * fornecedor específico. Adapters concretos (`gemini.ts`, `openai.ts`,
 * `mcp.ts`) implementam esta interface. O runtime só depende dos types
 * aqui — trocar de fornecedor = trocar a implementação, não o código.
 *
 * Princípios:
 *  - Mensagens neutras (system/user/assistant/tool), sem shape específico.
 *  - Tools no formato JSON Schema (interoperável com OpenAI, Gemini, MCP).
 *  - Streaming opcional; runtime pode consumir texto+toolCalls sob demanda.
 *  - Confirmação (voz/texto) resolvida em outra camada
 *    (`confirmationMatcher`), não pelo provider.
 */

export type LLMRole = "system" | "user" | "assistant" | "tool";

export interface LLMTextPart {
  type: "text";
  text: string;
}

export interface LLMToolCallPart {
  type: "tool_call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface LLMToolResultPart {
  type: "tool_result";
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

export type LLMContentPart = LLMTextPart | LLMToolCallPart | LLMToolResultPart;

export interface LLMMessage {
  role: LLMRole;
  content: LLMContentPart[];
  /** Metadata opcional — quem falou (usuário/humano/assistant id), timestamp, etc. */
  meta?: Record<string, unknown>;
}

/** Tool declarada ao modelo (formato provider-agnostic — mapeado no adapter). */
export interface LLMToolDeclaration {
  name: string;
  description: string;
  /** JSON Schema draft-07 compatível. */
  parameters: Record<string, unknown>;
  /** Marcadores para o runtime — providers ignoram. */
  needsApproval?: boolean;
  kind?: "query" | "command";
}

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Efeito nos providers que suportam raciocínio explícito (ex.: OpenAI o-series, Gemini thinking). */
  reasoning?: "none" | "low" | "medium" | "high";
  /** Sinal de aborto (cancelar/parar do usuário). */
  signal?: AbortSignal;
  /** Extras específicos do provider — passthrough. */
  providerOptions?: Record<string, unknown>;
}

export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
}

export type LLMFinishReason =
  | "stop"
  | "tool_calls"
  | "length"
  | "content_filter"
  | "error"
  | "aborted";

export interface LLMGenerateResult {
  message: LLMMessage;
  toolCalls: LLMToolCallPart[];
  finishReason: LLMFinishReason;
  usage?: LLMUsage;
  raw?: unknown;
}

export type LLMStreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "reasoning-delta"; delta: string }
  | { type: "tool-call"; call: LLMToolCallPart }
  | { type: "usage"; usage: LLMUsage }
  | { type: "finish"; reason: LLMFinishReason }
  | { type: "error"; error: Error };

/**
 * Contrato universal. Um provider é apenas uma função que sabe:
 *  - listar modelos suportados (opcional, para UI de seleção);
 *  - gerar (batch) ou streamar uma resposta com tools.
 */
export interface LLMProvider {
  readonly id: string;
  readonly displayName: string;
  /** Modelos disponíveis; runtime usa `defaultModel` quando `options.model` é omitido. */
  listModels(): Promise<Array<{ id: string; label: string; capabilities?: string[] }>>;
  readonly defaultModel: string;

  generate(input: {
    messages: LLMMessage[];
    tools?: LLMToolDeclaration[];
    options?: LLMGenerateOptions;
  }): Promise<LLMGenerateResult>;

  /** Opcional — providers sem streaming podem omitir; runtime cai para `generate`. */
  stream?(input: {
    messages: LLMMessage[];
    tools?: LLMToolDeclaration[];
    options?: LLMGenerateOptions;
  }): AsyncIterable<LLMStreamEvent>;
}

/** Erros normalizados — runtime não precisa saber shape do provider. */
export class LLMError extends Error {
  constructor(
    message: string,
    readonly code:
      | "rate_limited"
      | "credits_exhausted"
      | "invalid_request"
      | "auth"
      | "network"
      | "aborted"
      | "unknown",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
