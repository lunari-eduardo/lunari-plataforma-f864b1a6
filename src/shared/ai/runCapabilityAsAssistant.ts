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
import { supabase } from "@/integrations/supabase/client";
import type { AuthUser } from "@/shared/ports";
import type { ConfirmationChallenge } from "@/shared/capability/ai-adapter";
import {
  matchConfirmation,
  confirmationFailureMessage,
  type ConfirmationSource,
} from "./confirmationMatcher";

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

  // Gate de aprovação humana.
  if (opts.needsApproval && !opts.approvalToken) {
    const latencyMs = Math.round(performance.now() - t0);
    const invocationId = await recordInvocation({
      userId: opts.user.id,
      capabilityId,
      module: opts.module,
      kind: cap.kind,
      inputHash,
      outputStatus: "pending_approval",
      latencyMs,
      needsApproval: true,
    });
    return {
      status: "pending_approval",
      error: "human approval required",
      latencyMs,
      invocationId,
    };
  }

  try {
    // defineCommand/defineQuery expõem `execute(rawInput, overrides)` → Result.
    const result = await cap.execute(input, { user: opts.user, runtime: "client" });
    const latencyMs = Math.round(performance.now() - t0);
    if (result.ok === false) {
      const errObj = result.error;
      const message = errObj?.message ?? "Capability error";
      const denied = errObj?.code === "UNAUTHORIZED" || errObj?.code === "FORBIDDEN";
      const invocationId = await recordInvocation({
        userId: opts.user.id,
        capabilityId,
        module: opts.module,
        kind: cap.kind,
        inputHash,
        outputStatus: denied ? "denied" : "error",
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
      latencyMs,
      needsApproval: !!opts.needsApproval,
      approvedBy: opts.approvalToken ? opts.user.id : null,
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
