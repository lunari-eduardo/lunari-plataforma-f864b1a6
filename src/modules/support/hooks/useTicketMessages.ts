import { useEffect, useState, useCallback } from "react";
import { useSupportHost } from "../SupportHostProvider";
import * as msgs from "../services/messages.service";
import * as atts from "../services/attachments.service";
import type { SupportMessage, SupportAttachment } from "../types";

export function useTicketMessages(ticketId: string | undefined) {
  const host = useSupportHost();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!ticketId) return;
    try {
      setLoading(true);
      const [m, a] = await Promise.all([
        msgs.listMessages(host.supabase, ticketId),
        atts.listAttachmentsForTicket(host, ticketId),
      ]);
      setMessages(m);
      setAttachments(a);
    } finally {
      setLoading(false);
    }
  }, [host, ticketId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!ticketId) return;
    const ch = host.supabase
      .channel(`support:messages:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        async () => {
          // recarrega ambos para resolver anexos novos
          await refresh();
        }
      )
      .subscribe();
    return () => {
      host.supabase.removeChannel(ch);
    };
  }, [host, ticketId, refresh]);

  return { messages, attachments, loading, refresh };
}
