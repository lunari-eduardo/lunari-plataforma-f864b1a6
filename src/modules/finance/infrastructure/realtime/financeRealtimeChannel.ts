/**
 * Canal Realtime ÚNICO do módulo Finance.
 *
 * Cobre `fin_transactions` + `fin_items_master` em um único `supabase.channel`
 * por `userId`, no padrão `tasksRealtimeChannel`. Múltiplos consumidores
 * compartilham a mesma assinatura via `subscribe()`.
 *
 * O canal escreve direto nos stores (`transactionsStore`/`itemsStore`).
 * Listeners adicionais (ex.: bridge para invalidar TanStack Query) são
 * notificados depois do patch nos stores.
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { transactionsStore } from "../../presentation/store/transactionsStore";
import { itemsStore } from "../../presentation/store/itemsStore";
import { rowToTransacao, rowToItem } from "../supabase/mappers";
import type { Transacao, ItemFinanceiro } from "../../domain/types";

type Event = "INSERT" | "UPDATE" | "DELETE";
type Payload = {
  eventType: Event;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

export type FinanceRealtimeEvent =
  | { type: Event; entity: "transaction"; transacao?: Transacao; id?: string }
  | { type: Event; entity: "item"; item?: ItemFinanceiro; id?: string };

type Listener = (evt: FinanceRealtimeEvent) => void;
type StatusListener = (status: string) => void;

interface ChannelHandle {
  userId: string;
  channel: RealtimeChannel;
  listeners: Set<Listener>;
  statusListeners: Set<StatusListener>;
  refCount: number;
}

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
    .channel(`finance_v2:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "fin_transactions", filter: `user_id=eq.${userId}` },
      (payload) => {
        const p = payload as unknown as Payload;
        try {
          if (p.eventType === "DELETE") {
            const id = (p.old?.id as string) ?? undefined;
            if (id) {
              transactionsStore.remove(id);
              handle.listeners.forEach((l) => l({ type: "DELETE", entity: "transaction", id }));
            }
            return;
          }
          if (p.new) {
            const transacao = rowToTransacao(p.new);
            transactionsStore.upsert(transacao);
            handle.listeners.forEach((l) =>
              l({ type: p.eventType, entity: "transaction", transacao }),
            );
          }
        } catch (err) {
          console.error("[financeRealtime] erro no payload fin_transactions", err);
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "fin_items_master", filter: `user_id=eq.${userId}` },
      (payload) => {
        const p = payload as unknown as Payload;
        try {
          if (p.eventType === "DELETE") {
            const id = (p.old?.id as string) ?? undefined;
            if (id) {
              itemsStore.remove(id);
              handle.listeners.forEach((l) => l({ type: "DELETE", entity: "item", id }));
            }
            return;
          }
          if (p.new) {
            const item = rowToItem(p.new);
            itemsStore.upsert(item);
            handle.listeners.forEach((l) => l({ type: p.eventType, entity: "item", item }));
          }
        } catch (err) {
          console.error("[financeRealtime] erro no payload fin_items_master", err);
        }
      },
    )
    .subscribe((status) => {
      handle.statusListeners.forEach((l) => l(status));
    });

  handle.channel = channel;
  return handle;
}

export const financeRealtime = {
  subscribe(
    userId: string,
    listener?: Listener,
    statusListener?: StatusListener,
  ): () => void {
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
    if (statusListener) handle.statusListeners.add(statusListener);

    return () => {
      if (listener) handle.listeners.delete(listener);
      if (statusListener) handle.statusListeners.delete(statusListener);
      handle.refCount -= 1;
      if (handle.refCount <= 0) {
        supabase.removeChannel(handle.channel);
        if (active === handle) active = null;
      }
    };
  },

  _peek() {
    return active
      ? { userId: active.userId, refCount: active.refCount, listeners: active.listeners.size }
      : null;
  },
};
