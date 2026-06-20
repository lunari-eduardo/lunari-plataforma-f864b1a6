import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_LABEL, PRIORITY_LABEL, SUGGESTION_STATUS_LABEL,
} from "../../utils/labels";
import { useSupportHost } from "../../SupportHostProvider";
import { adminUpdateTicket, adminDeleteTicket } from "../../services/tickets.service";
import type { SupportTicket, TicketStatus, TicketPriority, SuggestionStatus } from "../../types";

const STATUS_OPTS: TicketStatus[] = [
  "novo", "recebido", "em_analise", "aguardando_cliente",
  "resolvido", "resolvido_whatsapp", "fechado",
];
const PRIO_OPTS: TicketPriority[] = ["baixa", "normal", "alta", "urgente"];
const SUG_OPTS: SuggestionStatus[] = [
  "recebida", "em_analise", "planejada", "em_desenvolvimento", "implementada", "recusada",
];

export function AdminTicketActions({
  ticket,
  onChanged,
  onDeleted,
  onOpenCreateFAQ,
}: {
  ticket: SupportTicket;
  onChanged: () => void;
  onDeleted: () => void;
  onOpenCreateFAQ: () => void;
}) {
  const host = useSupportHost();

  const patch = async (p: Parameters<typeof adminUpdateTicket>[2]) => {
    try {
      await adminUpdateTicket(host.supabase, ticket.id, p);
      onChanged();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Excluir este chamado? Esta ação não pode ser desfeita.")) return;
    try {
      await adminDeleteTicket(host.supabase, ticket.id);
      onDeleted();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Ações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Status</label>
          <Select value={ticket.status} onValueChange={(v) => patch({ status: v as TicketStatus })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Prioridade</label>
          <Select value={ticket.priority} onValueChange={(v) => patch({ priority: v as TicketPriority })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIO_OPTS.map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {ticket.categoria === "sugestao" && (
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Status da sugestão</label>
            <Select
              value={ticket.suggestion_status ?? ""}
              onValueChange={(v) => patch({ suggestion_status: v as SuggestionStatus })}
            >
              <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {SUG_OPTS.map((s) => (
                  <SelectItem key={s} value={s}>{SUGGESTION_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5 pt-2">
          <Button size="sm" variant="outline" className="w-full" onClick={() => patch({ status: "resolvido" })}>
            Marcar como resolvido
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={() => patch({ status: "resolvido_whatsapp" })}>
            Resolvido via WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={() => patch({ status: "fechado" })}>
            Fechar chamado
          </Button>
          <Button size="sm" variant="secondary" className="w-full" onClick={onOpenCreateFAQ}>
            Criar artigo do FAQ
          </Button>
          <Button size="sm" variant="destructive" className="w-full" onClick={handleDelete}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
