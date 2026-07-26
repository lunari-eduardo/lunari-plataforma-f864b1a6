import { z } from "zod";
import { defineQuery, defineCommand } from "@/shared/capability";
import { ok, err, domainError } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { observationSink } from "@/shared/observation";

/**
 * Onda 7 — Capabilities do Observation Engine v1.
 *
 * `observation.recent` (query, cheap): últimos N eventos do usuário.
 * `observation.record` (command, cheap): grava um evento manual (útil para
 * canais que não passam pelo Event Bus in-process — ex.: server, MCP).
 *
 * A engine é passiva: não interpreta, não agrega, não decide.
 */

export const observationRecentCapability = defineQuery({
  id: "observation.recent",
  title: "Ver eventos recentes",
  description:
    "Retorna os eventos de domínio mais recentes do usuário (audit passivo). Sem interpretação.",
  input: z.object({
    limit: z.number().int().min(1).max(200).optional(),
    eventType: z.string().max(128).optional().nullable(),
    entityType: z.string().max(64).optional().nullable(),
    entityId: z.string().max(128).optional().nullable(),
    since: z.string().datetime().optional().nullable(),
  }),
  output: z.object({
    events: z.array(
      z.object({
        id: z.string(),
        occurred_at: z.string(),
        source: z.string(),
        event_type: z.string(),
        entity_type: z.string().nullable(),
        entity_id: z.string().nullable(),
        payload: z.record(z.unknown()),
      }),
    ),
  }),
  permissions: ["observation:read"],
  costHint: "cheap",
  async handler(input, ctx) {
    try {
      if (!ctx.user?.id) {
        return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
      }
      let q = supabase
        .from("observation_events")
        .select("id, occurred_at, source, event_type, entity_type, entity_id, payload")
        .eq("user_id", ctx.user.id)
        .order("occurred_at", { ascending: false })
        .limit(input.limit ?? 50);

      if (input.eventType) q = q.eq("event_type", input.eventType);
      if (input.entityType) q = q.eq("entity_type", input.entityType);
      if (input.entityId) q = q.eq("entity_id", input.entityId);
      if (input.since) q = q.gte("occurred_at", input.since);

      const { data, error } = await q;
      if (error) throw error;
      return ok({ events: (data ?? []) as never });
    } catch (e) {
      return err(
        domainError("OBSERVATION_READ_FAILED", "Não foi possível ler eventos.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const observationRecordCapability = defineCommand({
  id: "observation.record",
  title: "Registrar evento observado",
  description:
    "Grava um evento no sink passivo da Observation Engine. Append-only; não modifica estado de negócio.",
  input: z.object({
    source: z.string().min(1).max(64),
    eventType: z.string().min(1).max(128),
    entityType: z.string().max(64).optional().nullable(),
    entityId: z.string().max(128).optional().nullable(),
    occurredAt: z.string().datetime().optional().nullable(),
    payload: z.record(z.unknown()).optional(),
  }),
  output: z.object({ ok: z.literal(true) }),
  permissions: ["observation:write"],
  costHint: "cheap",
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    await observationSink.record({
      userId: ctx.user.id,
      source: input.source,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      occurredAt: input.occurredAt ?? undefined,
      payload: input.payload,
    });
    return ok({ ok: true as const });
  },
});
