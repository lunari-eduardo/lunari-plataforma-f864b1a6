/**
 * Contrato único de execução (Rodada A2 do roteiro MCP).
 *
 * Uma capability sempre tem um `handler` — a implementação canônica que roda
 * no cliente, dentro do Kernel (validação Zod, Policy, eventos, auditoria).
 *
 * `execution` declara COMO a mesma capability é executada fora do browser
 * (servidor MCP, automações server-side). O dispatcher genérico em
 * `supabase/functions/_shared/capability-dispatch.ts` lê esse metadado do
 * catálogo e resolve o transporte, eliminando handlers escritos à mão.
 *
 * Capabilities sem `execution` são `client-only` e NÃO entram no catálogo MCP
 * — é isso que acaba com o catálogo-fachada (tool anunciada sem executor).
 */

export type CapabilityTransport = "rpc" | "edge" | "client-only";

export interface RpcExecution {
  transport: "rpc";
  /** Nome da função Postgres (`sb.rpc(name, args)`). */
  name: string;
  /** Converte o input validado nos argumentos da RPC. Default: identidade. */
  mapInput?: (input: unknown) => Record<string, unknown>;
}

export interface EdgeExecution {
  transport: "edge";
  /** Nome da edge function (`/functions/v1/<fn>`). */
  fn: string;
  /** Converte o input validado no body enviado. Default: identidade. */
  mapInput?: (input: unknown) => unknown;
}

export interface ClientOnlyExecution {
  transport: "client-only";
  /** Motivo — aparece no inventário e ajuda a priorizar migrações. */
  reason?: string;
}

export type CapabilityExecution = RpcExecution | EdgeExecution | ClientOnlyExecution;

export const CLIENT_ONLY: ClientOnlyExecution = { transport: "client-only" };

export function isRemotelyExecutable(e: CapabilityExecution): boolean {
  return e.transport !== "client-only";
}

/**
 * Forma serializável do `execution`, embarcada no catálogo. Funções
 * (`mapInput`) não atravessam JSON: quando existem, o catálogo marca
 * `mapped: true` e o dispatcher envia o input cru — a normalização
 * precisa então viver dentro da própria RPC/edge.
 */
export interface SerializedExecution {
  type: CapabilityTransport;
  name?: string;
  mapped?: boolean;
  reason?: string;
}

export function serializeExecution(e: CapabilityExecution): SerializedExecution {
  if (e.transport === "rpc") {
    return { type: "rpc", name: e.name, mapped: typeof e.mapInput === "function" };
  }
  if (e.transport === "edge") {
    return { type: "edge", name: e.fn, mapped: typeof e.mapInput === "function" };
  }
  return { type: "client-only", reason: e.reason };
}

/**
 * Timeout por perfil de custo — aplicado tanto no dispatcher server-side
 * quanto no `runCapabilityAsAssistant` no cliente.
 */
export const TIMEOUT_BY_COST: Record<string, number> = {
  cheap: 8_000,
  medium: 20_000,
  expensive: 45_000,
};

export function timeoutForCost(costHint: string | undefined): number {
  return TIMEOUT_BY_COST[costHint ?? "cheap"] ?? TIMEOUT_BY_COST.cheap;
}
