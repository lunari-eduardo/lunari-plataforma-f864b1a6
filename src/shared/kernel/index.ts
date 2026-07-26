/**
 * Kernel — ponto único de despacho de capabilities.
 *
 * ADR-0001. Toda execução de capability DEVE passar por `kernel.execute()`.
 * Chamadas diretas a `cap.execute(...)` são detectadas e:
 *   - em modo padrão: emitem um warning em console;
 *   - em `KERNEL_STRICT_MODE`: retornam Err("KERNEL_BYPASS").
 *
 * O Kernel resolve a capability no registry, constrói o `Actor` a partir de
 * um `AuthUser | null` recebido do caller, e delega para o `execute` interno
 * da capability preservando validação, autorização e emissão de eventos.
 *
 * NÃO substitui runCapabilityAsAssistant — o wrapper de assistente permanece,
 * mas passa pelo Kernel por baixo (auditoria + gate de aprovação ficam onde
 * estão até a Onda 2/Policy).
 */

import type { AuthUser } from "@/shared/ports";
import { domainError, err, type DomainError, type Result } from "@/shared/result";
import { getCapability } from "@/shared/capability/registry";
import type { Capability, CapabilityContext } from "@/shared/capability/types";

export interface Actor {
  user: AuthUser | null;
  /** Origem da invocação — usado por Policy/Audit no futuro. */
  channel: "web" | "assistant" | "mcp" | "system" | "test";
  runtime: "client" | "server";
}

export interface KernelExecuteOptions {
  actor: Actor;
}

/**
 * Modo estrito: chamadas diretas a `cap.execute()` sem passar pelo Kernel
 * viram erro. Ativado via `VITE_KERNEL_STRICT_MODE=1` para testes internos.
 */
export const KERNEL_STRICT_MODE: boolean =
  (import.meta as { env?: Record<string, string | undefined> })?.env
    ?.VITE_KERNEL_STRICT_MODE === "1";

/**
 * Marcador de invocação legítima. Um valor único é definido pelo Kernel
 * imediatamente antes de chamar `cap.execute`, e limpo depois. O wrapper em
 * `define.ts` consulta este marcador para diferenciar bypass de chamada
 * autorizada. Como o motor de capabilities é single-threaded (JS), basta um
 * counter simples — não há race entre dispatches síncronos.
 */
let _kernelGuardDepth = 0;

export function _kernelBeginDispatch(): void {
  _kernelGuardDepth++;
}
export function _kernelEndDispatch(): void {
  _kernelGuardDepth = Math.max(0, _kernelGuardDepth - 1);
}
export function _isInsideKernelDispatch(): boolean {
  return _kernelGuardDepth > 0;
}

async function dispatch<T = unknown>(
  cap: Capability,
  input: unknown,
  actor: Actor,
): Promise<Result<T, DomainError>> {
  _kernelBeginDispatch();
  try {
    const overrides: Partial<Pick<CapabilityContext, "user" | "runtime">> = {
      user: actor.user,
      runtime: actor.runtime,
    };
    const result = (await cap.execute(input, overrides)) as Result<T, DomainError>;
    return result;
  } finally {
    _kernelEndDispatch();
  }
}

export const kernel = {
  /**
   * Executa uma capability por ID. Este é o único método público para
   * disparar uma capability a partir de qualquer interface (UI, assistente,
   * MCP, workers, testes).
   */
  async execute<T = unknown>(
    capabilityId: string,
    input: unknown,
    options: KernelExecuteOptions,
  ): Promise<Result<T, DomainError>> {
    const cap = getCapability(capabilityId);
    if (!cap) {
      return err(
        domainError("NOT_FOUND", `Capability não encontrada: ${capabilityId}`, {
          retriable: false,
          details: { capabilityId },
        }),
      );
    }
    return dispatch<T>(cap, input, options.actor);
  },

  /**
   * Variante tipada quando o caller já tem a referência da capability.
   * Mantém o mesmo guarda de bypass. Preferir `execute(id, …)` em código
   * genérico; usar esta forma apenas em callsites fortemente tipados.
   */
  async run<T = unknown>(
    cap: Capability,
    input: unknown,
    options: KernelExecuteOptions,
  ): Promise<Result<T, DomainError>> {
    return dispatch<T>(cap, input, options.actor);
  },
};

/**
 * Helper para construir um Actor a partir do AuthUser da UI web.
 */
export function webActor(user: AuthUser | null): Actor {
  return { user, channel: "web", runtime: "client" };
}

export function assistantActor(user: AuthUser | null): Actor {
  return { user, channel: "assistant", runtime: "client" };
}

export function systemActor(): Actor {
  return { user: null, channel: "system", runtime: "server" };
}
