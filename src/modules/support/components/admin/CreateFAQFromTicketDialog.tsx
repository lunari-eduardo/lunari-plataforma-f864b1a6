import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MarkdownEditor } from "../shared/MarkdownEditor";
import { FAQ_CATEGORY_LABEL, slugify } from "../../utils/labels";
import { useSupportHost } from "../../SupportHostProvider";
import { upsertFAQ } from "../../services/faq.service";
import type { FAQCategory, SupportTicket, SupportMessage, TicketCategory } from "../../types";

const FAQ_CATS: FAQCategory[] = [
  "conta", "galerias", "lunari_studio", "lunari_gallery",
  "financeiro", "assinatura", "configuracoes", "outros",
];

const TICKET_TO_FAQ: Record<TicketCategory, FAQCategory> = {
  problema_tecnico: "outros",
  duvida: "outros",
  sugestao: "outros",
  financeiro: "financeiro",
  conta: "conta",
  galerias: "galerias",
  outro: "outros",
};

export function CreateFAQFromTicketDialog({
  open,
  onOpenChange,
  ticket,
  messages,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: SupportTicket;
  messages: SupportMessage[];
}) {
  const host = useSupportHost();
  const lastAdminMsg = [...messages].reverse().find((m) => m.author_role === "admin");
  const [pergunta, setPergunta] = useState(ticket.assunto);
  const [resposta, setResposta] = useState(lastAdminMsg?.body ?? "");
  const [category, setCategory] = useState<FAQCategory>(TICKET_TO_FAQ[ticket.categoria]);
  const [slug, setSlug] = useState(slugify(ticket.assunto));
  const [publish, setPublish] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!pergunta.trim() || !resposta.trim()) {
      toast.error("Pergunta e resposta são obrigatórias");
      return;
    }
    setSaving(true);
    try {
      await upsertFAQ(host.supabase, {
        slug: slug || slugify(pergunta),
        category,
        pergunta: pergunta.trim(),
        resposta: resposta.trim(),
        keywords: [],
        media: [],
        ordem: 0,
        published: publish,
        active: true,
        source_ticket_id: ticket.id,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar artigo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar artigo do FAQ a partir do chamado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as FAQCategory)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FAQ_CATS.map((c) => (
                    <SelectItem key={c} value={c}>{FAQ_CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pergunta</Label>
            <Input value={pergunta} onChange={(e) => setPergunta(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Resposta</Label>
            <MarkdownEditor value={resposta} onChange={setResposta} rows={8} maxLength={10000} />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Publicar agora
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar artigo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
