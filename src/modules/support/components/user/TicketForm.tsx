import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { MarkdownEditor } from "../shared/MarkdownEditor";
import { AttachmentsUploader } from "../shared/AttachmentsUploader";
import { useSupportHost } from "../../SupportHostProvider";
import { createTicket } from "../../services/tickets.service";
import { postMessage } from "../../services/messages.service";
import { uploadAndRegisterAttachment } from "../../services/attachments.service";
import { captureTechnicalSnapshot } from "../../services/technicalSnapshot";
import { CATEGORY_LABEL } from "../../utils/labels";
import { SUPPORT_ROUTES } from "../../config";
import type { TicketCategory, PendingAttachment } from "../../types";

const CATEGORIAS: TicketCategory[] = [
  "problema_tecnico",
  "duvida",
  "sugestao",
  "financeiro",
  "conta",
  "galerias",
  "outro",
];

export function TicketForm() {
  const host = useSupportHost();
  const navigate = useNavigate();
  const [assunto, setAssunto] = useState("");
  const [categoria, setCategoria] = useState<TicketCategory | "">("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const lockRef = useRef(false);

  const reset = () => {
    setAssunto("");
    setCategoria("");
    setBody("");
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockRef.current) return;
    if (!host.currentUser) {
      toast.error("Você precisa estar autenticado");
      return;
    }
    const assuntoTrim = assunto.trim();
    const bodyTrim = body.trim();
    if (assuntoTrim.length < 3) {
      toast.error("Assunto muito curto");
      return;
    }
    if (!categoria) {
      toast.error("Selecione uma categoria");
      return;
    }
    if (bodyTrim.length < 1 && pending.length === 0) {
      toast.error("Descreva o problema ou anexe um arquivo");
      return;
    }
    lockRef.current = true;
    setSubmitting(true);
    const filesToUpload = pending;
    const snapshot = captureTechnicalSnapshot(host);
    try {
      const ticket = await createTicket(host.supabase, {
        userId: host.currentUser.id,
        assunto: assuntoTrim,
        categoria: categoria as TicketCategory,
        technicalSnapshot: snapshot,
      });
      const msg = await postMessage(host.supabase, {
        ticketId: ticket.id,
        authorId: host.currentUser.id,
        authorRole: "user",
        body: bodyTrim || "[anexo]",
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
          console.error("Falha ao subir anexo", err);
          toast.error(`Falha ao subir ${p.file.name}: ${err?.message ?? "erro desconhecido"}`);
          failed.push(p);
        }
      }
      if (failed.length === 0) {
        reset();
      } else {
        // mantém os que falharam para o usuário retentar no detalhe do ticket
        setPending(failed);
      }
      navigate(SUPPORT_ROUTES.user.ticket(ticket.id));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Erro ao abrir chamado");
    } finally {
      setSubmitting(false);
      lockRef.current = false;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Não encontrou? Fale com o suporte</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat" className="text-xs">
                Categoria
              </Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as TicketCategory)}>
                <SelectTrigger id="cat" className="h-9">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assunto" className="text-xs">
                Assunto
              </Label>
              <Input
                id="assunto"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Resumo curto"
                maxLength={200}
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem</Label>
            <MarkdownEditor
              value={body}
              onChange={setBody}
              placeholder="Descreva com detalhes — quando começou, onde acontece, prints/vídeos ajudam muito."
              rows={8}
              maxLength={10000}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anexos</Label>
            <AttachmentsUploader pending={pending} onChange={setPending} disabled={submitting} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              <Send className="mr-2 h-4 w-4" />
              {submitting ? "Enviando…" : "Abrir chamado"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
