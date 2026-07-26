/**
 * Observation Engine v1 (ADR-012)
 *
 * Sink passivo de eventos de domínio. Grava em `public.observation_events`
 * (append-only, owner-scoped por RLS). NÃO interpreta, agrega ou decide —
 * apenas registra. Consumidores futuros (Memory, Intelligence) lêem daqui.
 *
 * Uso:
 *   - `observationSink.record(...)` para gravar direto (canal server/system).
 *   - `bindObservationToEventBus()` para plugar o sink no Event Bus in-process
 *     e capturar todos os eventos de domínio emitidos por Capabilities.
 *
 * Falhas de gravação são logadas e engolidas: observação nunca pode quebrar
 * o fluxo principal de negócio.
 */

import { supabase } from "@/integrations/supabase/client";
import { eventBus, type DomainEvent, type EventName } from "@/shared/event-bus";

export interface ObservationEntry {
  userId: string;
  source: string; // ex.: "event-bus", "capability", "system"
  eventType: string; // nome do evento/capability
  entityType?: string | null;
  entityId?: string | null;
  occurredAt?: string; // ISO
  payload?: Record<string, unknown>;
}

export interface ObservationSink {
  record(entry: ObservationEntry): Promise<void>;
}

/**
 * Sink padrão: grava via cliente Supabase autenticado. RLS bloqueia
 * inserções que não sejam do próprio usuário.
 */
export const observationSink: ObservationSink = {
  async record(entry) {
    try {
      const row = {
        user_id: entry.userId,
        source: entry.source,
        event_type: entry.eventType,
        entity_type: entry.entityType ?? null,
        entity_id: entry.entityId ?? null,
        occurred_at: entry.occurredAt ?? new Date().toISOString(),
        payload: entry.payload ?? {},
      };
      const { error } = await supabase.from("observation_events").insert([row]);
      if (error) console.warn("[observation] insert failed", error.message);
    } catch (e) {
      console.warn("[observation] sink threw", e);
    }
  },
};

/**
 * Extrai entity {type,id} de payloads convencionais quando possível.
 * Convenções aceitas: `entityType`+`entityId`, ou `<x>Id` para campos únicos.
 */
function extractEntity(payload: unknown): { entityType?: string; entityId?: string } {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  const entityType = typeof p.entityType === "string" ? p.entityType : undefined;
  const entityId =
    typeof p.entityId === "string"
      ? p.entityId
      : typeof p.id === "string"
        ? p.id
        : undefined;
  return { entityType, entityId };
}

let unsubscribe: (() => void) | null = null;

/**
 * Registra listener wildcard no Event Bus. Idempotente.
 * `resolveUserId`: função que retorna o `user_id` atual (ex.: do AuthContext).
 * Se retornar `null`, o evento é ignorado (sem sessão = sem gravação).
 */
export function bindObservationToEventBus(resolveUserId: () => string | null): () => void {
  if (unsubscribe) return unsubscribe;

  unsubscribe = eventBus.onAny(async (event: DomainEvent<EventName>) => {
    const userId = event.actorId ?? resolveUserId();
    if (!userId) return;

    const { entityType, entityId } = extractEntity(event.payload);
    await observationSink.record({
      userId,
      source: event.source ?? "event-bus",
      eventType: event.name,
      entityType,
      entityId,
      occurredAt: event.occurredAt,
      payload: (event.payload ?? {}) as Record<string, unknown>,
    });
  });

  return unsubscribe;
}

export function unbindObservation(): void {
  unsubscribe?.();
  unsubscribe = null;
}
