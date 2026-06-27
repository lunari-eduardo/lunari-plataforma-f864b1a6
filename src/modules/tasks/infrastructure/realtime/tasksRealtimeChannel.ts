/**
 * Canal Realtime ÚNICO para `tasks`.
 *
 * Substitui as N assinaturas duplicadas espalhadas em `useSupabaseTasks`.
 * Mantém referência singleton por `userId`; múltiplos consumidores compartilham
 * a mesma assinatura via `subscribe()`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { dbRowToTask } from "../supabase/tasksRepo";
import { tasksStore } from "../../presentation/store/tasksStore";
import type { Task } from "../../domain/types";

type Event = "INSERT" | "UPDATE" | "DELETE";
type Payload = {
  eventType: Event;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

type RealtimeListener = (evt: { type: Event; task?: Task; id?: string }) => void;

interface ChannelHandle {
  userId: string;
  channel: RealtimeChannel;
  listeners: Set<RealtimeListener>;
  statusListeners: Set<StatusListener>;
  refCount: number;
}

type StatusListener = (status: string) => void;

let active: ChannelHandle | null = null;

function attachChannel(userId: string): ChannelHandle {
  const handle: ChannelHandle = {
    userId,
    channel: null as unknown as RealtimeChannel,
    listeners: new Set(),
    statusListeners: new Set(),
    refCount: 0,
  };
  const channel = supabase
    .channel(`tasks_v2:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
      (payload) => {
        const p = payload as unknown as Payload;
        try {
          if (p.eventType === "DELETE") {
            const id = (p.old?.id as string) ?? undefined;
            if (id) {
              tasksStore.remove(id);
              handle.listeners.forEach((l) => l({ type: "DELETE", id }));
            }
            return;
          }
          if (p.new) {
            const task = dbRowToTask(p.new);
            tasksStore.upsert(task);
            handle.listeners.forEach((l) => l({ type: p.eventType, task }));
          }
        } catch (err) {
          console.error("[tasksRealtime] erro processando payload", err);
        }
      },
    )
    .subscribe((status) => {
      handle.statusListeners.forEach((l) => l(status));
    });
  handle.channel = channel;
  return handle;
}

export const tasksRealtime = {
  /**
   * Assina o canal único. Retorna cleanup que decrementa refCount e
   * remove o canal quando o último consumidor sair.
   */
  subscribe(userId: string, listener?: RealtimeListener): () => void {
    if (!active || active.userId !== userId) {
      if (active) {
        supabase.removeChannel(active.channel);
        active = null;
      }
      active = attachChannel(userId);
    }
    const handle = active;
    handle.refCount += 1;
    if (listener) handle.listeners.add(listener);

    return () => {
      if (listener) handle.listeners.delete(listener);
      handle.refCount -= 1;
      if (handle.refCount <= 0) {
        supabase.removeChannel(handle.channel);
        if (active === handle) active = null;
      }
    };
  },

  /** Debug. */
  _peek() {
    return active
      ? { userId: active.userId, refCount: active.refCount, listeners: active.listeners.size }
      : null;
  },
};
