/**
 * Adaptador de tools: capability Lunari → declaração LLM neutra.
 *
 * Fase B — permite que qualquer provider (Gemini/OpenAI/MCP) receba as
 * mesmas tools sem conhecer o formato interno das capabilities.
 */

import type { AuthUser } from "@/shared/ports";
import { listAllLunariAITools } from "../registry";
import type { LLMToolDeclaration } from "./types";

export function buildLLMToolsForUser(user: AuthUser | null): LLMToolDeclaration[] {
  const tools = listAllLunariAITools({ user });
  return tools.map((t) => ({
    name: t.id,
    description: t.description,
    parameters: (t.inputSchema ?? { type: "object", properties: {} }) as Record<
      string,
      unknown
    >,
    needsApproval: (t as { needsApproval?: boolean }).needsApproval,
    kind: t.kind,
  }));
}
