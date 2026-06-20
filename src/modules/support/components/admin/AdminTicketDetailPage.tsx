import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageThread } from "../user/MessageThread";
import { MarkdownEditor } from "../shared/MarkdownEditor";
import { AttachmentsUploader } from "../shared/AttachmentsUploader";
import { StatusBadge } from "../shared/StatusBadge";
import { CategoryBadge } from "../shared/CategoryBadge";
import { PriorityBadge } from "../shared/PriorityBadge";
import { AdminTicketActions } from "./AdminTicketActions";
import { InternalNotesPanel } from "./InternalNotesPanel";
import { TechnicalSnapshotPanel } from "./TechnicalSnapshotPanel";
import { CreateFAQFromTicketDialog } from "./CreateFAQFromTicketDialog";
import { useTicket } from "../../hooks/useTickets";
import { useTicketMessages } from "../../hooks/useTicketMessages";
import { postMessage } from "../../services/messages.service";
import { uploadAndRegisterAttachment } from "../../services/attachments.service";
import { useSupportHost } from "../../SupportHostProvider";
import { formatTicketNumber } from "../../utils/labels";
import { SUPPORT_ROUTES } from "../../config";
import type { PendingAttachment } from "../../types";

export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const host = useSupportHost();
  const { ticket, loading, refresh: refreshTicket } = useTicket(id);
  const { messages, attachments, refresh: refreshMsgs } = useTicketMessages(id);

  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const lockRef = useRef(false);

  const handleSend = async () => {
    if (lockRef.current) return;
    if (!ticket || !host.currentUser) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    lockRef.current = true;
    setSending(true);
    const savedBody = trimmed;
    const filesToUpload = pending;
    setBody("");
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
    try {
      const msg = await postMessage(host.supabase, {
        ticketId: ticket.id,
        authorId: host.currentUser.id,
        authorRole: "admin",
        body: savedBody,
      });
      for (const p of filesToUpload) {
        try {
          await uploadAndRegisterAttachment(host, {
            ticketId: ticket.id,
            messageId: msg.id,
            file: p.file,
          });
        } catch (err) {
          console.error(err);
          toast.error(`Falha ao subir anexo: ${p.file.name}`);
        }
      }
      await refreshMsgs();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar");
      setBody(savedBody);
    } finally {
      setSending(false);
      lockRef.current = false;
    }
  };

  if (loading || !ticket) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando chamado…</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-start gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(SUPPORT_ROUTES.admin.tickets)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{formatTicketNumber(ticket.numero)}</span>
            <CategoryBadge categoria={ticket.categoria} />
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
          <h1 className="mt-1 text-lg font-semibold">{ticket.assunto}</h1>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <MessageThread
            messages={messages}
            attachments={attachments}
            currentUserId={host.currentUser?.id ?? null}
          />

          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
            <MarkdownEditor value={body} onChange={setBody} placeholder="Resposta do suporte…" rows={4} maxLength={10000} />
            <AttachmentsUploader pending={pending} onChange={setPending} disabled={sending} />
            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={sending || !body.trim()}>
                <Send className="mr-2 h-4 w-4" /> {sending ? "Enviando…" : "Responder"}
              </Button>
            </div>
          </div>

          <InternalNotesPanel ticketId={ticket.id} />
        </div>

        <aside className="space-y-4 md:sticky md:top-4 md:self-start">
          <AdminTicketActions
            ticket={ticket}
            onChanged={refreshTicket}
            onDeleted={() => navigate(SUPPORT_ROUTES.admin.tickets)}
            onOpenCreateFAQ={() => setFaqOpen(true)}
          />
          <TechnicalSnapshotPanel snapshot={ticket.technical_snapshot} />
        </aside>
      </div>

      <CreateFAQFromTicketDialog
        open={faqOpen}
        onOpenChange={setFaqOpen}
        ticket={ticket}
        messages={messages}
      />
    </div>
  );
}
