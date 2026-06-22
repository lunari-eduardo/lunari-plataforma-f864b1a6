import type { z, ZodTypeAny } from "zod";
import type { AuthUser } from "@/shared/ports";
import type { EventName, EventPayload } from "@/shared/event-bus";
import type { DomainError, Result } from "@/shared/result";

export type CapabilityKind = "command" | "query";

export type CostHint = "cheap" | "medium" | "expensive";

export type AuditMode = "always" | "on-success" | "never";

export interface CapabilityExample<I, O> {
  /** Frase em linguagem natural que o usuário diria. */
  nl: string;
  input: I;
  output?: O;
}

/**
 * Side effect declarado. Formato livre mas convencionado:
 *  - "db:<tabela>"            → escreve nessa tabela
 *  - "event:<nome>"           → emite esse evento (deve existir em LunariEvents)
 *  - "external:<integracao>"  → chama integração externa (asaas, mp, r2, gcal…)
 *  - "email" | "notification" → envia comunicação
 */
export type SideEffect = `db:${string}` | `event:${string}` | `external:${string}` | "email" | "notification";

export interface CapabilityContext {
  user: AuthUser | null;
  /** Emite evento de domínio. Só aceita eventos declarados em sideEffects. */
  emit<N extends EventName>(name: N, payload: EventPayload<N>): Promise<void>;
  /** Logger escopado à capability. */
  log: {
    debug(msg: string, ctx?: Record<string, unknown>): void;
    info(msg: string, ctx?: Record<string, unknown>): void;
    warn(msg: string, ctx?: Record<string, unknown>): void;
    error(msg: string, ctx?: Record<string, unknown>): void;
  };
  /** Indica se está executando no servidor (Edge Function) ou no cliente. */
  runtime: "client" | "server";
  /** Capability ID em execução. */
  capabilityId: string;
}

export interface DefineCapabilityOptions<TInput extends ZodTypeAny, TOutput extends ZodTypeAny> {
  id: string;
  title: string;
  description: string;
  input: TInput;
  output: TOutput;
  permissions?: string[];
  sideEffects?: SideEffect[];
  needsApproval?: boolean | ((args: { input: z.infer<TInput>; user: AuthUser | null }) => boolean);
  idempotencyKey?: (input: z.infer<TInput>) => string | null;
  audit?: AuditMode;
  costHint?: CostHint;
  examples?: CapabilityExample<z.infer<TInput>, z.infer<TOutput>>[];
  /**
   * Handler puro da capability. Recebe input já validado e o contexto.
   * Pode retornar valor (Ok) ou Result<>; em caso de exceção, vira Err com code "INTERNAL".
   */
  handler: (
    input: z.infer<TInput>,
    ctx: CapabilityContext,
  ) => Promise<z.infer<TOutput> | Result<z.infer<TOutput>, DomainError>>;
}

export interface Capability<TInput extends ZodTypeAny = ZodTypeAny, TOutput extends ZodTypeAny = ZodTypeAny> {
  readonly id: string;
  readonly kind: CapabilityKind;
  readonly title: string;
  readonly description: string;
  readonly input: TInput;
  readonly output: TOutput;
  readonly permissions: string[];
  readonly sideEffects: SideEffect[];
  readonly audit: AuditMode;
  readonly costHint: CostHint;
  readonly examples: CapabilityExample<z.infer<TInput>, z.infer<TOutput>>[];
  needsApproval(args: { input: z.infer<TInput>; user: AuthUser | null }): boolean;
  idempotencyKeyFor(input: z.infer<TInput>): string | null;
  /** Executa a capability com input bruto. Valida, autoriza, audita, emite eventos. */
  execute(
    rawInput: unknown,
    overrides?: Partial<Pick<CapabilityContext, "user" | "runtime">>,
  ): Promise<Result<z.infer<TOutput>, DomainError>>;
}
