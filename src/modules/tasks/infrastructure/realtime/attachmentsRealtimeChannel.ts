/**
 * Canal Realtime ÚNICO para `task_attachments`.
 * Mantém o `attachmentsStore` sincronizado.
 */
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { attachmentsStore } from "../../presentation/store/attachmentsStore";
import { rowToAttachment } from "../supabase/attachmentsRepo";

type Event = "INSERT" | "UPDATE" | "DELETE";
type Payload = {
  eventType: Event;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

interface Handle {
  userId: string;
  channel: RealtimeChannel;
  refCount: number;
  statusListeners: Set<(s: string) => void>;
}

let active: Handle | null = null;

function attach(userId: string): Handle {
  const handle: Handle = {
    userId,
    channel: null as unknown as RealtimeChannel,
    refCount: 0,
    statusListeners: new Set(),
  };
  const ch = supabase
    .channel(`task_attachments_v2:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "task_attachments",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const p = payload as unknown as Payload;
        try {
          if (p.eventType === "DELETE") {
            const id = (p.old?.id as string) ?? undefined;
            if (id) attachmentsStore.remove(id);
            return;
          }
          if (p.new) attachmentsStore.upsert(rowToAttachment(p.new));
        } catch (err) {
          console.error("[attachmentsRealtime] payload error", err);
        }
      },
    )
    .subscribe((status) => handle.statusListeners.forEach((l) => l(status)));
  handle.channel = ch;
  return handle;
}

export const attachmentsRealtime = {
  subscribe(userId: string, statusListener?: (s: string) => void): () => void {
    if (!active || active.userId !== userId) {
      if (active) supabase.removeChannel(active.channel);
      active = attach(userId);
    }
    const handle = active;
    handle.refCount += 1;
    if (statusListener) handle.statusListeners.add(statusListener);
    return () => {
      if (statusListener) handle.statusListeners.delete(statusListener);
      handle.refCount -= 1;
      if (handle.refCount <= 0) {
        supabase.removeChannel(handle.channel);
        if (active === handle) active = null;
      }
    };
  },
};
