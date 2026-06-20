import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { AttachmentPreview } from "../shared/AttachmentPreview";
import type { SupportMessage, SupportAttachment } from "../../types";

export function MessageBubble({
  message,
  attachments,
  currentUserId,
}: {
  message: SupportMessage;
  attachments: SupportAttachment[];
  currentUserId: string | null;
}) {
  const mine = message.author_id === currentUserId && message.author_role === "user";
  const isAdmin = message.author_role === "admin";

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] space-y-2 rounded-2xl border px-4 py-3 text-sm",
          mine
            ? "rounded-br-sm border-primary/30 bg-primary/10 text-foreground"
            : isAdmin
            ? "rounded-bl-sm border-emerald-500/30 bg-emerald-500/5"
            : "rounded-bl-sm border-border bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{isAdmin ? "Suporte" : mine ? "Você" : "Cliente"}</span>
          <span>·</span>
          <span>{format(new Date(message.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
        </div>
        <MarkdownRenderer source={message.body} />
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {attachments.map((a) => (
              <AttachmentPreview key={a.id} attachment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageThread({
  messages,
  attachments,
  currentUserId,
}: {
  messages: SupportMessage[];
  attachments: SupportAttachment[];
  currentUserId: string | null;
}) {
  const byMsg = useMemo(() => {
    const map = new Map<string | null, SupportAttachment[]>();
    for (const a of attachments) {
      const k = a.message_id;
      const arr = map.get(k) ?? [];
      arr.push(a);
      map.set(k, arr);
    }
    return map;
  }, [attachments]);

  const initialAttachments = byMsg.get(null) ?? [];

  return (
    <div className="space-y-4">
      {messages.map((m, idx) => (
        <MessageBubble
          key={m.id}
          message={m}
          attachments={[
            ...(idx === 0 ? initialAttachments : []),
            ...(byMsg.get(m.id) ?? []),
          ]}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
