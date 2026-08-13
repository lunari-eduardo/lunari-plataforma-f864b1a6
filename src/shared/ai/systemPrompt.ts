/**
 * Onda E.2 — System prompt dinâmico da Lunari.
 *
 * Monta o bloco de contexto (page snapshot + capabilities visíveis) que
 * é enviado ao runtime `assistant-chat` no campo `system`. A edge function
 * concatena com o system prompt canônico da Lunari (invariantes de segurança).
 *
 * Regras:
 *  - Snapshot é serializado como JSON compacto dentro de bloco delimitado.
 *  - Truncamos para ~8 KB para não estourar contexto.
 *  - Nunca incluímos segredos, PII fora do necessário, ou dados de outros
 *    usuários (as fontes já filtram por `user.id`).
 */
import type { AuthUser } from "@/shared/ports";
import {
  getPageSnapshot,
  listAllLunariAITools,
  type LunariPage,
  type AllPageSnapshots,
} from "./registry";

const MAX_SNAPSHOT_CHARS = 8_000;

export interface AssistantSystemContext {
  page: LunariPage;
  user: AuthUser | null;
  /** Rótulos legíveis extras (ex.: nome do módulo, filtros ativos). */
  hints?: Record<string, string | number | boolean | null>;
}

export interface AssistantSystemPayload {
  /** Texto pronto para o campo `system` do `assistant-chat`. */
  system: string;
  /** Snapshot original (útil para debug/telemetria no cliente). */
  snapshot: AllPageSnapshots[LunariPage];
  /** Capabilities visíveis ao usuário nesta página (ids). */
  visibleCapabilityIds: string[];
}

function safeStringify(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    if (json.length <= MAX_SNAPSHOT_CHARS) return json;
    // Truncamento explícito — marcador para a Lunari saber que foi cortado.
    return json.slice(0, MAX_SNAPSHOT_CHARS - 20) + '..."__truncated__"}';
  } catch {
    return "{}";
  }
}

export function buildAssistantSystemPrompt(
  ctx: AssistantSystemContext,
): AssistantSystemPayload {
  const snapshot = getPageSnapshot(ctx.page, ctx.user);
  const tools = listAllLunariAITools({ user: ctx.user });
  const visibleCapabilityIds = tools.map((t) => t.id);

  const capabilitySummary = tools.map((t) => ({
    id: t.id,
    module: t.module,
    kind: t.kind,
    needsApproval: t.needsApproval,
    description: t.description,
  }));

  const hintsBlock = ctx.hints
    ? `\n\n[HINTS]\n${JSON.stringify(ctx.hints)}`
    : "";

  const system = [
    `[CONTEXTO DE PÁGINA]`,
    `A usuária está em: ${ctx.page} (rota: ${
      (snapshot as { route?: string }).route ?? "?"
    }).`,
    `Snapshot (JSON) — estado visível no momento da mensagem:`,
    "```json",
    safeStringify(snapshot),
    "```",
    ``,
    `[CAPABILITIES DISPONÍVEIS NESTE TURNO — ${capabilitySummary.length}]`,
    `Você só pode chamar tools cujo id apareça nesta lista. Não invente ids.`,
    "```json",
    safeStringify(capabilitySummary),
    "```",
    hintsBlock,
  ].join("\n");

  return { system, snapshot, visibleCapabilityIds };
}
