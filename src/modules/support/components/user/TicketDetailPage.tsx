import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MarkdownEditor } from "../shared/MarkdownEditor";
import { AttachmentsUploader } from "../shared/AttachmentsUploader";
import { MessageThread } from "./MessageThread";
import { StatusBadge } from "../shared/StatusBadge";
import { CategoryBadge } from "../shared/CategoryBadge";
import { useSupportHost } from "../../SupportHostProvider";
import { useTicket } from "../../hooks/useTickets";
import { useTicketMessages } from "../../hooks/useTicketMessages";
import { postMessage } from "../../services/messages.service";
import { uploadAndRegisterAttachment } from "../../services/attachments.service";
import { formatTicketNumber } from "../../utils/labels";
import { SUPPORT_ROUTES } from "../../config";
import type { PendingAttachment } from "../../types";

const CLOSED_STATES = new Set(["fechado", "resolvido", "resolvido_whatsapp"]);

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const host = useSupportHost();
  const { ticket, loading } = useTicket(id);
  const { messages, attachments, loading: loadingMsgs, refresh } = useTicketMessages(id);

  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const lockRef = useRef(false);

  const isClosed = ticket ? CLOSED_STATES.has(ticket.status) : false;

  const handleSend = async () => {
    if (lockRef.current) return;
    if (!ticket || !host.currentUser) return;
    const trimmed = body.trim();
    if (trimmed.length < 1 && pending.length === 0) {
      toast.error("Escreva uma mensagem ou anexe um arquivo");
      return;
    }
    lockRef.current = true;
    setSending(true);
    const filesToUpload = pending;
    const savedBody = trimmed;
    setBody("");
    setPending([]);
    try {
      const msg = await postMessage(host.supabase, {
        ticketId: ticket.id,
        authorId: host.currentUser.id,
        authorRole: host.isAdmin && ticket.user_id !== host.currentUser.id ? "admin" : "user",
        body: savedBody || "[anexo]",
      });
      const failed: PendingAttachment[] = [];
      for (const p of filesToUpload) {
        try {
          await uploadAndRegisterAttachment(host, {
            ticketId: ticket.id,
            messageId: msg.id,
            file: p.file,
          });
        } catch (err: any) {
          console.error(err);
          toast.error(`Falha ao subir ${p.file.name}: ${err?.message ?? "erro desconhecido"}`);
          failed.push(p);
        }
      }
      // libera preview apenas dos que subiram OK
      filesToUpload
        .filter((p) => !failed.includes(p))
        .forEach((p) => URL.revokeObjectURL(p.previewUrl));
      if (failed.length > 0) setPending(failed);
      await refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Erro ao enviar mensagem");
      setBody(savedBody);
      setPending(filesToUpload);
    } finally {
      setSending(false);
      lockRef.current = false;
    }
  };

  if (loading || !ticket) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Carregando chamado…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(SUPPORT_ROUTES.user.home)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {formatTicketNumber(ticket.numero)}
            </span>
            <CategoryBadge categoria={ticket.categoria} />
            <StatusBadge status={ticket.status} />
          </div>
          <h1 className="text-lg font-semibold text-foreground">{ticket.assunto}</h1>
        </div>
      </div>

      {loadingMsgs ? (
        <p className="text-xs text-muted-foreground">Carregando mensagens…</p>
      ) : (
        <MessageThread
          messages={messages}
          attachments={attachments}
          currentUserId={host.currentUser?.id ?? null}
        />
      )}

      <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
        {isClosed ? (
          <p className="text-center text-xs text-muted-foreground">
            Chamado encerrado. Abra um novo se precisar.
          </p>
        ) : (
          <>
            <MarkdownEditor
              value={body}
              onChange={setBody}
              placeholder="Escreva sua resposta…"
              rows={4}
              maxLength={10000}
            />
            <AttachmentsUploader pending={pending} onChange={setPending} disabled={sending} />
            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Enviando…" : "Enviar resposta"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
