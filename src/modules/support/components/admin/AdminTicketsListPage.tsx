import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useAdminTickets } from "../../hooks/useAdminTickets";
import { STATUS_LABEL, CATEGORY_LABEL, PRIORITY_LABEL, formatTicketNumber } from "../../utils/labels";
import { StatusBadge } from "../shared/StatusBadge";
import { CategoryBadge } from "../shared/CategoryBadge";
import { PriorityBadge } from "../shared/PriorityBadge";
import { SUPPORT_ROUTES } from "../../config";
import type { TicketStatus, TicketCategory, TicketPriority } from "../../types";

const STATUS_OPTS: TicketStatus[] = [
  "novo", "recebido", "em_analise", "aguardando_cliente",
  "resolvido", "resolvido_whatsapp", "fechado",
];
const CAT_OPTS: TicketCategory[] = [
  "problema_tecnico", "duvida", "sugestao", "financeiro", "conta", "galerias", "outro",
];
const PRIO_OPTS: TicketPriority[] = ["baixa", "normal", "alta", "urgente"];

export default function AdminTicketsListPage() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  const initialStatus = (sp.get("status")?.split(",").filter(Boolean) as TicketStatus[]) || [];
  const initialCat = (sp.get("categoria")?.split(",").filter(Boolean) as TicketCategory[]) || [];

  const [status, setStatus] = useState<TicketStatus | "all">(
    initialStatus.length === 1 ? initialStatus[0] : "all"
  );
  const [categoria, setCategoria] = useState<TicketCategory | "all">(
    initialCat.length === 1 ? initialCat[0] : "all"
  );
  const [priority, setPriority] = useState<TicketPriority | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const filters = useMemo(
    () => ({
      status: status === "all" ? (initialStatus.length > 1 ? initialStatus : undefined) : [status],
      categoria:
        categoria === "all" ? (initialCat.length > 1 ? initialCat : undefined) : [categoria],
      priority: priority === "all" ? undefined : [priority],
      search,
      limit,
      offset: page * limit,
    }),
    [status, categoria, priority, search, page, initialStatus, initialCat]
  );

  const { rows, total, loading } = useAdminTickets(filters);

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Chamados</h1>
        <span className="text-xs text-muted-foreground">{total} total</span>
      </header>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por assunto…"
            className="h-9 pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v as any); setPage(0); }}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTS.map((s) => (<SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={categoria} onValueChange={(v) => { setCategoria(v as any); setPage(0); }}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CAT_OPTS.map((c) => (<SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nº</th>
              <th className="px-3 py-2">Assunto</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Prioridade</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">Carregando…</td></tr>
            )}
            {!loading && !rows.length && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum chamado.</td></tr>
            )}
            {rows.map((t) => (
              <tr
                key={t.id}
                onClick={() => navigate(SUPPORT_ROUTES.admin.ticket(t.id))}
                className="cursor-pointer border-t border-border/50 hover:bg-muted/30"
              >
                <td className="px-3 py-2 font-mono text-xs">{formatTicketNumber(t.numero)}</td>
                <td className="px-3 py-2 font-medium">{t.assunto}</td>
                <td className="px-3 py-2"><CategoryBadge categoria={t.categoria} /></td>
                <td className="px-3 py-2"><PriorityBadge priority={t.priority} /></td>
                <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(t.last_message_at).toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">Página {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={(page + 1) * limit >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
