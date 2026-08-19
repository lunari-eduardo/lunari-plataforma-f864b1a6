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

const MAX_SNAPSHOT_CHARS = 3_000;

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

  const now = new Date();
  const nowStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const isoDateStr = now.toISOString().split("T")[0];

  const system = [
    `[CONTEXTO TEMPORAL]`,
    `Hoje é ${nowStr}, às ${timeStr} (Data ISO atual: ${isoDateStr}).`,
    `Use esta data como referência exata para interpretar "hoje", "amanhã", "próxima sexta", "mês que vem", "dez de dezembro deste ano", etc.`,
    ``,
    `[CONTEXTO DE PÁGINA]`,
    `A usuária está em: ${ctx.page} (rota: ${
      (snapshot as { route?: string }).route ?? "?"
    }).`,
    `Snapshot (JSON) — estado visível no momento da mensagem:`,
    "```json",
    safeStringify(snapshot),
    "```",
    ``,
    `[DIRETRIZES OPERACIONAIS DE AGENDA E CLIENTES]`,
    `- BLOQUEIOS: Para bloquear um dia inteiro na agenda, use 'agenda.blockDate' (com date em YYYY-MM-DD e reason opcional). Para desbloquear um dia, use 'agenda.unblockDate'. Para bloquear horário específico, use 'agenda.blockSlot'. Para desbloquear horário, use 'agenda.unblockSlot'.`,
    `- COMPROMISSOS & EVENTOS: Para criar eventos pessoais (médico, dentista, pessoal, etc.), use 'agenda.createPersonalEvent'. Para reuniões, use 'agenda.createMeeting'. Para sessões fotográficas, use 'agenda.createSession'.`,
    `- IDENTIFICAÇÃO DE CLIENTES (ÁGIL E INTELIGENTE):`,
    `  * Sempre que o usuário solicitar agendamento ou reunião para um cliente por nome, chame 'clientes.searchAndMatch'.`,
    `  * A busca encontra clientes mesmo se o usuário omitir nomes do meio (ex: "Eduardo Diehl" encontra "Eduardo Valmor Diehl").`,
    `  * Se houver 1 correspondência clara, PROSSIGA com o agendamento usando o 'clienteId' e o nome cadastrado desse cliente.`,
    `  * APENAS quando houver ambiguidade real (ex: o usuário citar apenas "agende a Juliana" e existirem 2 ou mais Julianas cadastradas como "Juliana Santos" e "Juliana Lima"), pergunte ao usuário qual delas utilizar, exibindo telefone ou e-mail para identificação.`,
    `  * Se o cliente não existir no cadastro, agende com o nome informado pelo usuário e informe que o cadastro pode ser criado quando desejar.`,
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
