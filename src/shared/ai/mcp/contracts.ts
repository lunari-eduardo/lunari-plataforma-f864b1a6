/**
 * Contratos MCP (Model Context Protocol) para o Lunari.
 *
 * Fase C — define o shape provider-agnostic pelo qual capabilities Lunari
 * são expostas a servidores MCP (Claude/ChatGPT/Cursor/Codex/n8n).
 * Nenhum servidor é embutido aqui; esta camada apenas descreve o contrato
 * e adapta capabilities → `MCPTool`. O host MCP (edge function ou runtime
 * externo) consome estes tipos.
 *
 * Princípios:
 *  - Namespacing por módulo: `lunari.<module>.<action>` (ex.: `lunari.finance.transaction.create`).
 *  - JSON Schema draft-07 nos parâmetros (interoperável com MCP SDK).
 *  - Annotations padrão MCP (`readOnlyHint`, `destructiveHint`, `idempotentHint`).
 *  - Escrita/mutação sempre passa pelo `runCapabilityAsAssistant` — nunca
 *    executa direto no banco.
 */

import type { AuthUser } from "@/shared/ports";
import { listAllLunariAITools } from "../registry";

export type MCPToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  requiresApprovalHint?: boolean;
};

export interface MCPToolContent {
  type: "text";
  text: string;
}

export interface MCPToolResult {
  content: MCPToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface MCPTool {
  /** Nome MCP totalmente qualificado (`lunari.<module>.<action>`). */
  name: string;
  /** Título curto para UIs de conector. */
  title: string;
  /** Descrição de 1-2 frases (o cliente MCP escolhe tools por aqui). */
  description: string;
  /** JSON Schema dos parâmetros. */
  inputSchema: Record<string, unknown>;
  /** JSON Schema do retorno — o dispatcher usa para montar structuredContent. */
  outputSchema: Record<string, unknown>;
  annotations: MCPToolAnnotations;
  /** Capability Lunari original — o host resolve via dispatcher genérico. */
  capabilityId: string;
  /** A2 — transporte declarado no `defineCapability`. */
  transport?: { type: "rpc" | "edge"; name: string; mapped?: boolean };
  /** Escopo OAuth/PAT exigido. */
  scope: "read" | "write";
  kind: "command" | "query";
  needsApproval: boolean;
  costHint: string;
}

export interface BuildMCPToolsOptions {
  user: AuthUser | null;
  /** Prefixo do namespace; default `lunari`. */
  namespace?: string;
}

/**
 * Converte capabilities Lunari em tools MCP.
 *
 * A2 — entram apenas capabilities cuja `audience` inclui "mcp". Quando a
 * capability declara `execution` remoto (rpc/edge), o campo `transport` vai
 * junto e o servidor usa o dispatcher genérico; sem ele, o servidor recorre
 * ao bridge legado escrito à mão (migração incremental, sem quebrar o catálogo).
 */
export function buildMCPToolsForUser(opts: BuildMCPToolsOptions): MCPTool[] {
  const { user, namespace = "lunari" } = opts;
  const tools = listAllLunariAITools({ user });

  const out: MCPTool[] = [];
  for (const t of tools) {
    if (t.audience && !t.audience.includes("mcp")) continue;
    const exec = t.execution;

    const needsApproval = (t as { needsApproval?: boolean }).needsApproval === true;
    const [module, ...rest] = t.id.split(".");
    const action = rest.join(".");
    const name = `${namespace}.${module}.${action}`;

    out.push({
      name,
      title: t.id,
      description: t.description,
      inputSchema: (t.inputSchema ?? { type: "object", properties: {} }) as Record<
        string,
        unknown
      >,
      outputSchema: (t.outputSchema ?? { type: "object", properties: {} }) as Record<
        string,
        unknown
      >,
      annotations: {
        readOnlyHint: t.kind === "query",
        destructiveHint: needsApproval && t.kind === "command",
        idempotentHint: t.kind === "query",
        openWorldHint: false,
        requiresApprovalHint: needsApproval,
      },
      capabilityId: t.id,
      transport:
        exec && exec.type !== "client-only" && exec.name
          ? { type: exec.type, name: exec.name, mapped: exec.mapped }
          : undefined,
      scope: t.kind === "query" ? "read" : "write",
      kind: t.kind,
      needsApproval,
      costHint: t.costHint,
    });
  }
  return out;
}


/** Resposta MCP padronizada para erro de autorização/approval. */
export function mcpApprovalRequired(capabilityId: string): MCPToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `A ação "${capabilityId}" exige aprovação humana explícita (approvalToken ou confirmationInput). Solicite ao usuário no app antes de invocar via MCP.`,
      },
    ],
  };
}

/** Wrap de resultado de capability para o shape MCP. */
export function mcpOk(structured: unknown, textSummary?: string): MCPToolResult {
  return {
    content: [
      {
        type: "text",
        text: textSummary ?? JSON.stringify(structured),
      },
    ],
    structuredContent:
      structured && typeof structured === "object"
        ? (structured as Record<string, unknown>)
        : { value: structured },
  };
}

export function mcpError(message: string, cause?: unknown): MCPToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: cause ? `${message}: ${String((cause as Error)?.message ?? cause)}` : message,
      },
    ],
  };
}
