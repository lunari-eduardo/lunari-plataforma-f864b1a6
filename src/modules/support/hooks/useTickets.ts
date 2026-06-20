import { useEffect, useState, useCallback } from "react";
import { useSupportHost } from "../SupportHostProvider";
import * as svc from "../services/tickets.service";
import type { SupportTicket } from "../types";

export function useMyTickets() {
  const host = useSupportHost();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!host.currentUser) {
      setTickets([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const rows = await svc.listMyTickets(host.supabase, host.currentUser.id);
      setTickets(rows);
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!host.currentUser) return;
    const ch = host.supabase
      .channel(`support:my-tickets:${host.currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
          filter: `user_id=eq.${host.currentUser.id}`,
        },
        () => refresh()
      )
      .subscribe();
    return () => {
      host.supabase.removeChannel(ch);
    };
  }, [host, refresh]);

  return { tickets, loading, refresh };
}

export function useTicket(id: string | undefined) {
  const host = useSupportHost();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const t = await svc.getTicket(host.supabase, id);
      setTicket(t);
    } finally {
      setLoading(false);
    }
  }, [host, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!id) return;
    const ch = host.supabase
      .channel(`support:ticket:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${id}` },
        (payload) => setTicket(payload.new as SupportTicket)
      )
      .subscribe();
    return () => {
      host.supabase.removeChannel(ch);
    };
  }, [host, id]);

  return { ticket, loading, refresh };
}
