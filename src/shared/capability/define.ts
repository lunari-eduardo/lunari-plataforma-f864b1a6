import type { z, ZodTypeAny } from "zod";
import { eventBus, type EventName, type EventPayload } from "@/shared/event-bus";
import { domainError, err, isOk, ok, type DomainError, type Result } from "@/shared/result";
import { authorize } from "./policies";
import { registerCapability } from "./registry";
import type {
  Capability,
  CapabilityContext,
  CapabilityKind,
  DefineCapabilityOptions,
} from "./types";

function makeLogger(capabilityId: string) {
  const fmt = (lvl: string, msg: string, ctx?: Record<string, unknown>) =>
    // eslint-disable-next-line no-console
    console[lvl as "log"](`[cap ${capabilityId}] ${msg}`, ctx ?? "");
  return {
    debug: (m: string, c?: Record<string, unknown>) => fmt("debug", m, c),
    info: (m: string, c?: Record<string, unknown>) => fmt("info", m, c),
    warn: (m: string, c?: Record<string, unknown>) => fmt("warn", m, c),
    error: (m: string, c?: Record<string, unknown>) => fmt("error", m, c),
  };
}

function isResultLike<T>(v: unknown): v is Result<T, DomainError> {
  return (
    typeof v === "object" &&
    v !== null &&
    "ok" in v &&
    typeof (v as { ok: unknown }).ok === "boolean"
  );
}

function build<TInput extends ZodTypeAny, TOutput extends ZodTypeAny>(
  kind: CapabilityKind,
  opts: DefineCapabilityOptions<TInput, TOutput>,
): Capability<TInput, TOutput> {
  const sideEffects = opts.sideEffects ?? [];
  const allowedEvents = new Set<string>(
    sideEffects
      .filter((s): s is `event:${EventName}` => s.startsWith("event:"))
      .map((s) => s.slice("event:".length)),
  );

  const needsApprovalFn =
    typeof opts.needsApproval === "function"
      ? opts.needsApproval
      : () => Boolean(opts.needsApproval);

  const cap: Capability<TInput, TOutput> = {
    id: opts.id,
    kind,
    title: opts.title,
    description: opts.description,
    input: opts.input,
    output: opts.output,
    permissions: opts.permissions ?? [],
    sideEffects,
    audit: opts.audit ?? (kind === "command" ? "on-success" : "never"),
    costHint: opts.costHint ?? "cheap",
    examples: opts.examples ?? [],
    needsApproval: needsApprovalFn,
    idempotencyKeyFor: (input) => (opts.idempotencyKey ? opts.idempotencyKey(input) : null),

    async execute(rawInput, overrides) {
      const startedAt = performance.now?.() ?? Date.now();
      const user = overrides?.user ?? null;
      const runtime: "client" | "server" = overrides?.runtime ?? "client";
      const log = makeLogger(opts.id);

      const auth = authorize(user, opts.permissions ?? []);
      if (!isOk(auth)) return auth;

      const parsed = opts.input.safeParse(rawInput);
      if (!parsed.success) {
        return err(
          domainError("VALIDATION", "Os dados fornecidos são inválidos.", {
            retriable: false,
            details: { issues: parsed.error.issues },
          }),
        );
      }

      const input = parsed.data as z.infer<TInput>;

      const ctx: CapabilityContext = {
        user,
        runtime,
        capabilityId: opts.id,
        log,
        async emit(name, payload) {
          if (!allowedEvents.has(name as string)) {
            log.warn(`emit("${String(name)}") bloqueado: não declarado em sideEffects`);
            return;
          }
          await eventBus.emit(name as EventName, payload as EventPayload<EventName>, {
            source: opts.id,
            actorId: user?.id ?? null,
          });
        },
      };

      try {
        const raw = await opts.handler(input, ctx);
        const result: Result<z.infer<TOutput>, DomainError> = isResultLike<z.infer<TOutput>>(raw)
          ? raw
          : ok(raw as z.infer<TOutput>);

        if (isOk(result)) {
          const outParsed = opts.output.safeParse(result.value);
          if (!outParsed.success) {
            log.error("output não bate com schema", { issues: outParsed.error.issues });
            return err(
              domainError("OUTPUT_VALIDATION", "Resposta interna inválida.", {
                retriable: false,
                details: { issues: outParsed.error.issues },
              }),
            );
          }
          return ok(outParsed.data as z.infer<TOutput>);
        }
        return result;
      } catch (e) {
        log.error("handler lançou exceção", { error: e });
        return err(
          domainError("INTERNAL", "Ocorreu um erro inesperado. Tente novamente.", {
            retriable: true,
            cause: e,
          }),
        );
      } finally {
        const durationMs = (performance.now?.() ?? Date.now()) - startedAt;
        log.debug(`execução concluída em ${durationMs.toFixed(1)}ms`);
      }
    },
  };

  registerCapability(cap as Capability);
  return cap;
}

export function defineCommand<TInput extends ZodTypeAny, TOutput extends ZodTypeAny>(
  opts: DefineCapabilityOptions<TInput, TOutput>,
): Capability<TInput, TOutput> {
  return build("command", opts);
}

export function defineQuery<TInput extends ZodTypeAny, TOutput extends ZodTypeAny>(
  opts: DefineCapabilityOptions<TInput, TOutput>,
): Capability<TInput, TOutput> {
  return build("query", opts);
}
