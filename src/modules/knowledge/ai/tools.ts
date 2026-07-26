import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  AI_KNOWLEDGE_ALLOWED,
  canUserRun,
  needsHumanApproval,
  listKnowledgeAICapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface KnowledgeAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listKnowledgeAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): KnowledgeAITool[] {
  const caps = listCapabilities({ module: "knowledge", kind: opts?.kind }).filter((c) =>
    AI_KNOWLEDGE_ALLOWED.has(c.id),
  );
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export interface KnowledgePageSnapshot {
  page: "knowledge";
  hint: string;
}

export function snapshotForKnowledge(_user: AuthUser | null): KnowledgePageSnapshot {
  return {
    page: "knowledge",
    hint:
      "Knowledge Engine v1: busca semântica sobre documentos do fotógrafo. Use knowledge.search para recuperar trechos relevantes; knowledge.embed para indexar novo conteúdo.",
  };
}

export { REQUIRES_APPROVAL, listKnowledgeAICapabilityIds };
