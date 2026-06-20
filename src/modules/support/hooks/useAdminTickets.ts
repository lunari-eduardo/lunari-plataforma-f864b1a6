import { useEffect, useState, useCallback } from "react";
import { useSupportHost } from "../SupportHostProvider";
import * as svc from "../services/tickets.service";
import type { SupportTicket } from "../types";

export function useAdminTickets(filters: svc.AdminTicketFilters) {
  const host = useSupportHost();
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await svc.adminListTickets(host.supabase, filters);
      setRows(r.rows);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }, [host, JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!host.isAdmin) return;
    const ch = host.supabase
      .channel("support:admin-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        refresh()
      )
      .subscribe();
    return () => {
      host.supabase.removeChannel(ch);
    };
  }, [host, refresh]);

  return { rows, total, loading, refresh };
}
