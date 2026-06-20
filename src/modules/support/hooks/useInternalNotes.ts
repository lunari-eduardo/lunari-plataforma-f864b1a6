import { useEffect, useState, useCallback } from "react";
import { useSupportHost } from "../SupportHostProvider";
import * as svc from "../services/internalNotes.service";
import type { SupportInternalNote } from "../types";

export function useInternalNotes(ticketId: string | undefined) {
  const host = useSupportHost();
  const [notes, setNotes] = useState<SupportInternalNote[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!ticketId || !host.isAdmin) return;
    try {
      setLoading(true);
      const list = await svc.listNotes(host.supabase, ticketId);
      setNotes(list);
    } finally {
      setLoading(false);
    }
  }, [host, ticketId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!ticketId || !host.isAdmin) return;
    const ch = host.supabase
      .channel(`support:notes:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_internal_notes",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => refresh()
      )
      .subscribe();
    return () => {
      host.supabase.removeChannel(ch);
    };
  }, [host, ticketId, refresh]);

  return { notes, loading, refresh };
}
