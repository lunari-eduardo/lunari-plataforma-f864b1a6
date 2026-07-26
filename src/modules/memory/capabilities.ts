import { z } from "zod";
import { defineQuery, defineCommand } from "@/shared/capability";
import { ok, err, domainError } from "@/shared/result";
import { memoryStore, isReservedMemoryKey } from "@/shared/memory";

/**
 * Onda 8 — Memory Engine v1.
 *
 * memory.recall  — busca por (scope,key) ou lista por scope.
 * memory.remember — upsert; needsApproval quando source=assistant e scope != assistant.
 * memory.forget  — remove entrada; needsApproval sempre.
 */

const ScopeSchema = z.enum(["user", "project", "assistant"]);
const SourceSchema = z.enum(["assistant", "manual", "inferred"]);
const KeySchema = z
  .string()
  .min(1)
  .max(128)
  .refine((k) => !isReservedMemoryKey(k), {
    message: "key reservada (conversation./message./turn./history./chat.).",
  });

const EntrySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  scope: ScopeSchema,
  key: z.string(),
  value: z.unknown(),
  source: SourceSchema,
  confidence: z.number(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const memoryRecallCapability = defineQuery({
  id: "memory.recall",
  title: "Recuperar memória",
  description:
    "Lê preferências e fatos duráveis do usuário. Passe `key` para item específico; sem `key`, lista o `scope`.",
  input: z.object({
    scope: ScopeSchema,
    key: KeySchema.optional(),
  }),
  output: z.object({
    entry: EntrySchema.nullable(),
    entries: z.array(EntrySchema),
  }),
  permissions: ["memory:read"],
  costHint: "cheap",
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      if (input.key) {
        const entry = await memoryStore.get(ctx.user.id, input.scope, input.key);
        return ok({ entry, entries: entry ? [entry] : [] });
      }
      const entries = await memoryStore.list(ctx.user.id, input.scope);
      return ok({ entry: null, entries });
    } catch (e) {
      return err(
        domainError("MEMORY_READ_FAILED", "Não foi possível ler a memória.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const memoryRememberCapability = defineCommand({
  id: "memory.remember",
  title: "Registrar memória",
  description:
    "Grava/atualiza uma preferência ou fato durável (upsert por scope+key). Não use para histórico de conversas.",
  input: z.object({
    scope: ScopeSchema,
    key: KeySchema,
    value: z.unknown(),
    source: SourceSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  }),
  output: z.object({ entry: EntrySchema }),
  permissions: ["memory:write"],
  costHint: "cheap",
  // Aprovação humana quando IA tenta gravar fora do próprio escopo `assistant`.
  needsApproval: ({ input }) =>
    (input.source ?? "manual") === "assistant" && input.scope !== "assistant",
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const entry = await memoryStore.set({
        userId: ctx.user.id,
        scope: input.scope,
        key: input.key,
        value: input.value,
        source: input.source,
        confidence: input.confidence,
        expiresAt: input.expiresAt ?? null,
      });
      return ok({ entry });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao gravar memória.";
      return err(
        domainError("MEMORY_WRITE_FAILED", msg, { retriable: false, cause: e }),
      );
    }
  },
});

export const memoryForgetCapability = defineCommand({
  id: "memory.forget",
  title: "Esquecer memória",
  description: "Remove uma entrada de memória por (scope,key). Requer confirmação humana.",
  input: z.object({
    scope: ScopeSchema,
    key: KeySchema,
  }),
  output: z.object({ removed: z.boolean() }),
  permissions: ["memory:write"],
  costHint: "cheap",
  needsApproval: true,
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const removed = await memoryStore.forget(ctx.user.id, input.scope, input.key);
      return ok({ removed });
    } catch (e) {
      return err(
        domainError("MEMORY_WRITE_FAILED", "Não foi possível remover a memória.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});
