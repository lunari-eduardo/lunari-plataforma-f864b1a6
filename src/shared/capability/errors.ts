/**
 * Contrato de erro único do Lunari (A2).
 *
 * Mesmo vocabulário nos dois caminhos de execução:
 *   - cliente (Kernel → DomainError)
 *   - servidor (dispatcher MCP → JSON-RPC)
 *
 * Mensagens cruas de banco NUNCA vazam para o cliente: viram INTERNAL e o
 * detalhe fica só na auditoria.
 */

export const CAPABILITY_ERROR_CODES = [
  "VALIDATION",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "APPROVAL_REQUIRED",
  "SCOPE_MISSING",
  "NOT_FOUND",
  "TIMEOUT",
  "INTERNAL",
] as const;

export type CapabilityErrorCode = (typeof CAPABILITY_ERROR_CODES)[number];

/** Mapeamento canônico para códigos JSON-RPC usados pelo servidor MCP. */
export const JSON_RPC_CODE_BY_ERROR: Record<CapabilityErrorCode, number> = {
  VALIDATION: -32602,
  UNAUTHORIZED: -32001,
  FORBIDDEN: -32002,
  APPROVAL_REQUIRED: -32003,
  SCOPE_MISSING: -32004,
  NOT_FOUND: -32601,
  TIMEOUT: -32005,
  INTERNAL: -32603,
};

/** Mensagem PT-BR segura para exibir ao usuário final. */
export const SAFE_MESSAGE_BY_ERROR: Record<CapabilityErrorCode, string> = {
  VALIDATION: "Os dados fornecidos são inválidos.",
  UNAUTHORIZED: "Você precisa estar autenticado para fazer isso.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  APPROVAL_REQUIRED: "Esta ação exige aprovação humana explícita.",
  SCOPE_MISSING: "Este token não possui o escopo necessário.",
  NOT_FOUND: "Recurso não encontrado.",
  TIMEOUT: "A operação demorou demais e foi cancelada. Tente novamente.",
  INTERNAL: "Ocorreu um erro inesperado. Tente novamente.",
};

export function isCapabilityErrorCode(v: unknown): v is CapabilityErrorCode {
  return typeof v === "string" && (CAPABILITY_ERROR_CODES as readonly string[]).includes(v);
}

/**
 * Normaliza qualquer `code` vindo do Kernel/Postgres para o vocabulário
 * canônico. Códigos desconhecidos viram INTERNAL.
 */
export function normalizeErrorCode(code: string | undefined | null): CapabilityErrorCode {
  if (isCapabilityErrorCode(code)) return code;
  switch (code) {
    case "OUTPUT_VALIDATION":
      return "INTERNAL";
    case "KERNEL_BYPASS":
      return "FORBIDDEN";
    default:
      return "INTERNAL";
  }
}
