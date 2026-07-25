/**
 * Onda E.3 — Execução client-side de tool calls emitidos pela Lu.
 *
 * O runtime backend (`assistant-chat`) declara as tools ao modelo mas
 * NÃO fornece `execute`. Cada tool_call volta para o cliente, que resolve
 * via `runCapabilityAsAssistant` (auditoria + approval central) usando
 * a sessão Supabase real do usuário (RLS + ownership).
 */

import { runCapabilityAsAssistant, getAllLunariAIToolsMap } from "@/shared/ai";
import type { AuthUser } from "@/shared/ports";

export interface ExecuteToolCallInput {
  toolName: string;
  input: unknown;
  user: AuthUser;
}

export interface ExecuteToolCallResult {
  status: "ok" | "error" | "denied" | "pending_approval";
  output?: unknown;
  error?: string;
  latencyMs?: number;
}

export async function executeAssistantToolCall({
  toolName,
  input,
  user,
}: ExecuteToolCallInput): Promise<ExecuteToolCallResult> {
  const map = getAllLunariAIToolsMap({ user });
  const tool = map[toolName];

  if (!tool) {
    return {
      status: "error",
      error: `Tool desconhecida ou indisponível: ${toolName}`,
    };
  }

  try {
    const res = await runCapabilityAsAssistant({
      capabilityId: tool.id,
      module: tool.module,
      input,
      user,
      needsApproval: tool.needsApproval,
    });
    return {
      status: res.status,
      output: res.output,
      error: res.error,
      latencyMs: res.latencyMs,
    };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
