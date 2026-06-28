/**
 * Bridge — monta o canal realtime de anexos e hidrata o `attachmentsStore`.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseAttachmentsRepo } from "../supabase/attachmentsRepo";
import { attachmentsRealtime } from "./attachmentsRealtimeChannel";
import { attachmentsStore } from "../../presentation/store/attachmentsStore";

const BACKOFF_MS = [1_000, 3_000, 10_000];

export function AttachmentsRealtimeBridge() {
  const { user } = useAuth();
  const backoffIdx = useRef(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const hydrate = async () => {
      try {
        const list = await supabaseAttachmentsRepo.listByUser(user.id);
        if (!cancelled) {
          attachmentsStore.hydrate(list);
          backoffIdx.current = 0;
        }
      } catch (err) {
        console.error("[AttachmentsRealtimeBridge] hidratação falhou", err);
        schedule();
      }
    };

    const schedule = () => {
      if (cancelled) return;
      const delay = BACKOFF_MS[Math.min(backoffIdx.current, BACKOFF_MS.length - 1)];
      backoffIdx.current += 1;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void hydrate(), delay);
    };

    void hydrate();
    const cleanup = attachmentsRealtime.subscribe(user.id, (status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") schedule();
      else if (status === "SUBSCRIBED") backoffIdx.current = 0;
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      cleanup();
      attachmentsStore.reset();
    };
  }, [user?.id]);

  return null;
}
