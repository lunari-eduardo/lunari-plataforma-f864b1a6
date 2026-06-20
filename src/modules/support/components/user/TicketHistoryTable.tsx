import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "../shared/StatusBadge";
import { CategoryBadge } from "../shared/CategoryBadge";
import { formatTicketNumber } from "../../utils/labels";
import { SUPPORT_ROUTES } from "../../config";
import type { SupportTicket } from "../../types";

export function TicketHistoryTable({ tickets }: { tickets: SupportTicket[] }) {
  const navigate = useNavigate();
  if (!tickets.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        Você ainda não abriu nenhum chamado.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Nº</TableHead>
            <TableHead>Assunto</TableHead>
            <TableHead className="hidden sm:table-cell">Categoria</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Última atualização</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((t) => (
            <TableRow
              key={t.id}
              className="cursor-pointer"
              onClick={() => navigate(SUPPORT_ROUTES.user.ticket(t.id))}
            >
              <TableCell className="font-mono text-xs">{formatTicketNumber(t.numero)}</TableCell>
              <TableCell className="font-medium">{t.assunto}</TableCell>
              <TableCell className="hidden sm:table-cell">
                <CategoryBadge categoria={t.categoria} />
              </TableCell>
              <TableCell>
                <StatusBadge status={t.status} />
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true, locale: ptBR })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
