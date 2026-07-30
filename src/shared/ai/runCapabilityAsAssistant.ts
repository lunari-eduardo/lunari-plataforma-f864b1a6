/**
 * Wrapper de execução de capability como "assistente".
 *
 * F2.2 — Toda invocação vinda da Lu passa por aqui:
 *  1. Verifica se a capability requer aprovação humana.
 *  2. Executa a capability (command ou query).
 *  3. Grava linha em `assistant_invocations` (auditoria — ASSISTANT_GUIDE).
 *
 * Não substitui a validação de permissões de cada superfície (`ai/permissions`).
 * É a última camada antes do `run(input)`.
 */

import { getCapability } from "@/shared/capability";
import { kernel, assistantActor } from "@/shared/kernel";
import { supabase } from "@/integrations/supabase/client";
import type { AuthUser } from "@/shared/ports";
import type { ConfirmationChallenge } from "@/shared/capability/ai-adapter";
import {
  matchConfirmation,
  confirmationFailureMessage,
  type ConfirmationSource,
} from "./confirmationMatcher";
import { needsHumanApproval as centralNeedsApproval } from "./approvalRegistry";
import { timeoutForCost } from "@/shared/capability/execution";
import { normalizeErrorCode, SAFE_MESSAGE_BY_ERROR } from "@/shared/capability/errors";

/** A2 — timeout único por costHint, igual ao dispatcher server-side. */
class CapabilityTimeoutError extends Error {
  constructor(ms: number) {
    super(`A operação demorou mais que ${Math.round(ms / 1000)}s e foi cancelada.`);
    this.name = "CapabilityTimeoutError";
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new CapabilityTimeoutError(ms)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export type AssistantOutputStatus = "ok" | "error" | "denied" | "pending_approval";

export interface AssistantRunOptions {
  user: AuthUser;
  approvalToken?: string;
  needsApproval?: boolean;
  /** Módulo declarado pelo caller (para auditoria). */
  module: string;
  /** Desafio ativo — quando a tool requer confirmação texto/voz. */
  confirmationChallenge?: ConfirmationChallenge;
  /** Resposta do usuário ao desafio (texto digitado ou transcrição de voz). */
  confirmationInput?: string;
  /** Origem da confirmação — informativa, gravada na auditoria. */
  confirmationSource?: ConfirmationSource;
}

export interface AssistantRunResult<T = unknown> {
  status: AssistantOutputStatus;
  output?: T;
  error?: string;
  latencyMs: number;
  invocationId?: string;
}


async function hashInput(input: unknown): Promise<string | null> {
  try {
    const json = JSON.stringify(input ?? null);
    if (!("crypto" in globalThis) || !globalThis.crypto?.subtle) {
      // Fallback simples (não criptográfico) para ambientes sem WebCrypto.
      let h = 0;
      for (let i = 0; i < json.length; i++) h = (h * 31 + json.charCodeAt(i)) | 0;
      return `fnv:${h}`;
    }
    const bytes = new TextEncoder().encode(json);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

async function recordInvocation(row: {
  userId: string;
  capabilityId: string;
  module: string;
  kind: "command" | "query";
  actor?: "assistant" | "user" | "system";
  inputHash: string | null;
  outputStatus: AssistantOutputStatus;
  errorMessage?: string;
  latencyMs: number;
  needsApproval: boolean;
  approvedBy?: string | null;
  /** A5 — ticket de aprovação vinculado (quando houve gate destrutivo). */
  approvalId?: string | null;
  confirmationMode?: string | null;
}): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from("assistant_invocations")
      .insert({
        user_id: row.userId,
        capability_id: row.capabilityId,
        module: row.module,
        kind: row.kind,
        actor: row.actor ?? "assistant",
        input_hash: row.inputHash,
        output_status: row.outputStatus,
        error_message: row.errorMessage ?? null,
        latency_ms: row.latencyMs,
        needs_approval: row.needsApproval,
        surface: "app",
        tool_name: row.capabilityId,
        approval_id: row.approvalId ?? null,
        approved_by: row.approvedBy ?? null,
        approved_at: row.approvedBy ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[assistant] auditoria falhou:", error.message);
      return undefined;
    }
    return data?.id as string | undefined;
  } catch (err) {
    console.warn("[assistant] auditoria exception:", err);
    return undefined;
  }
}

/**
 * A5 — toda ação destrutiva vira ticket em `assistant_approvals`, inclusive
 * quando resolvida por confirmação inline (texto/voz) dentro do app. Assim o
 * histórico de aprovações cobre app e MCP com o mesmo contrato.
 */
async function recordInlineApproval(args: {
  capabilityId: string;
  input: unknown;
  summary: string;
  confirmationMode: string;
  approved: boolean;
}): Promise<string | null> {
  try {
    const { data, error } = await (supabase.rpc as any)("assistant_approval_record_inline", {
      _tool_name: args.capabilityId,
      _tool_args: (args.input ?? {}) as Record<string, unknown>,
      _summary: args.summary,
      _confirmation_mode: args.confirmationMode,
      _approved: args.approved,
    });
    if (error) {
      console.warn("[assistant] ticket de aprovação falhou:", error.message);
      return null;
    }
    return (data as string) ?? null;
  } catch (err) {
    console.warn("[assistant] ticket de aprovação exception:", err);
    return null;
  }
}

/**
 * Executa uma capability em nome do Assistente Lu, com auditoria e
 * gate de aprovação humana.
 */
export async function runCapabilityAsAssistant<T = unknown>(
  capabilityId: string,
  input: unknown,
  opts: AssistantRunOptions,
): Promise<AssistantRunResult<T>> {
  const t0 = performance.now();
  const cap = getCapability(capabilityId);
  const inputHash = await hashInput(input);

  if (!cap) {
    const latencyMs = Math.round(performance.now() - t0);
    const invocationId = await recordInvocation({
      userId: opts.user.id,
      capabilityId,
      module: opts.module,
      kind: "command",
      inputHash,
      outputStatus: "error",
      errorMessage: `capability not found: ${capabilityId}`,
      latencyMs,
      needsApproval: !!opts.needsApproval,
    });
    return {
      status: "error",
      error: `capability not found: ${capabilityId}`,
      latencyMs,
      invocationId,
    };
  }

  // A6 — gate de rollout (admin → beta → geral). Fail-closed: qualquer erro
  // bloqueia a execução. O launcher escondido é UX; isto é a barreira real.
  {
    let rolloutAllowed = false;
    try {
      const { data, error } = await supabase.rpc("assistant_access_allowed", {
        _uid: opts.user.id,
      });
      rolloutAllowed = !error && data === true;
    } catch {
      rolloutAllowed = false;
    }
    if (!rolloutAllowed) {
      const latencyMs = Math.round(performance.now() - t0);
      const invocationId = await recordInvocation({
        userId: opts.user.id,
        capabilityId,
        module: opts.module,
        kind: cap.kind === "query" ? "query" : "command",
        inputHash,
        outputStatus: "blocked_by_rollout",
        errorMessage: "assistant_locked",
        latencyMs,
        needsApproval: !!opts.needsApproval,
      });
      return {
        status: "denied",
        error:
          "A assistente Lu está em teste fechado. Solicite acesso para participar do beta.",
        latencyMs,
        invocationId,
      };
    }
  }



  // Gate de aprovação humana — pode ser satisfeito por approvalToken OU por
  // uma confirmação texto/voz válida contra o desafio da tool.
  // D.1: cruzamos com o registry central para não depender só do caller.
  const requiresApproval = !!opts.needsApproval || centralNeedsApproval(capabilityId);
  let inlineApprovalId: string | null = null;
  if (requiresApproval && !opts.approvalToken) {
    let confirmed = false;
    let confirmationError: string | undefined;

    if (opts.confirmationInput !== undefined) {
      const match = matchConfirmation(
        opts.confirmationChallenge,
        opts.confirmationInput,
        { source: opts.confirmationSource },
      );
      confirmed = match.ok;
      if (!match.ok) {
        confirmationError = confirmationFailureMessage(match, opts.confirmationChallenge);
      }
    }

    if (!confirmed) {
      const latencyMs = Math.round(performance.now() - t0);
      const approvalId = await recordInlineApproval({
        capabilityId,
        input,
        summary: cap.title ?? capabilityId,
        confirmationMode: opts.confirmationSource ?? "none",
        approved: false,
      });
      const invocationId = await recordInvocation({
        approvalId,
        userId: opts.user.id,
        capabilityId,
        module: opts.module,
        kind: cap.kind,
        inputHash,
        outputStatus: "pending_approval",
        errorMessage: confirmationError,
        latencyMs,
        needsApproval: true,
      });
      return {
        status: "pending_approval",
        error: confirmationError ?? "human approval required",
        latencyMs,
        invocationId,
      };
    }
    // Confirmação válida → abre e fecha o ticket no mesmo instante.
    inlineApprovalId = await recordInlineApproval({
      capabilityId,
      input,
      summary: cap.title ?? capabilityId,
      confirmationMode: opts.confirmationSource ?? "text",
      approved: true,
    });
  }


  try {
    // defineCommand/defineQuery expõem `execute(rawInput, overrides)` → Result.
    const result = await withTimeout(
      kernel.run(cap, input, { actor: assistantActor(opts.user) }),
      timeoutForCost(cap.costHint),
    );
    const latencyMs = Math.round(performance.now() - t0);
    if (result.ok === false) {
      const errObj = result.error;
      const code = normalizeErrorCode(errObj?.code);
      const message = errObj?.message ?? SAFE_MESSAGE_BY_ERROR[code];
      const denied = code === "UNAUTHORIZED" || code === "FORBIDDEN";
      // Onda 2 — Policy Engine: Kernel devolve APPROVAL_REQUIRED quando
      // a política pediu confirmação e nenhum token/confirmação foi
      // provido. Convertemos em `pending_approval` idêntico ao gate legado.
      if (code === "APPROVAL_REQUIRED") {
        const invocationId = await recordInvocation({
          userId: opts.user.id,
          capabilityId,
          module: opts.module,
          kind: cap.kind,
          inputHash,
          outputStatus: "pending_approval",
          errorMessage: message,
          latencyMs,
          needsApproval: true,
        });
        return { status: "pending_approval", error: message, latencyMs, invocationId };
      }
      const invocationId = await recordInvocation({
        userId: opts.user.id,
        capabilityId,
        module: opts.module,
        kind: cap.kind,
        inputHash,
        outputStatus: denied ? "denied" : "error",
      approvalId: inlineApprovalId,
        errorMessage: message,
        latencyMs,
        needsApproval: !!opts.needsApproval,
      });
      return { status: denied ? "denied" : "error", error: message, latencyMs, invocationId };
    }
    const output = result.value as T;
    const invocationId = await recordInvocation({
      userId: opts.user.id,
      capabilityId,
      module: opts.module,
      kind: cap.kind,
      inputHash,
      outputStatus: "ok",
      approvalId: inlineApprovalId,
      latencyMs,
      needsApproval: !!opts.needsApproval,
      approvedBy: opts.approvalToken || opts.confirmationInput ? opts.user.id : null,
    });
    return { status: "ok", output, latencyMs, invocationId };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - t0);
    const message = err instanceof Error ? err.message : String(err);
    const invocationId = await recordInvocation({
      userId: opts.user.id,
      capabilityId,
      module: opts.module,
      kind: cap.kind,
      inputHash,
      outputStatus: "error",
      errorMessage: message,
      latencyMs,
      needsApproval: !!opts.needsApproval,
    });
    return { status: "error", error: message, latencyMs, invocationId };
  }
}
