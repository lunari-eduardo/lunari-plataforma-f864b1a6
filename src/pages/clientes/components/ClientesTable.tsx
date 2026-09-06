import React from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, MessageCircle, Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { OriginBadge } from '@/components/shared/OriginBadge';
import { ClientMetrics } from '@/hooks/useClientMetrics';
import {
  CLIENT_ROW,
  CLIENT_NAME,
  CLIENT_METRIC_VALUE,
  CLIENT_METRIC_PAID,
  CLIENT_METRIC_DUE,
  STATUS_BADGE_ACTIVE,
  STATUS_BADGE_NEW,
  CLIENT_ICON_ACTION,
  CLIENT_ICON_ACTION_DANGER,
} from '@/components/clientes/clienteTokens';
import { SortConfig, SortKey } from '../types';

interface ClientesTableProps {
  clientes: ClientMetrics[];
  sortConfig: SortConfig | null;
  onSort: (key: SortKey) => void;
  onWhatsApp: (cliente: ClientMetrics) => void;
  onEdit: (cliente: ClientMetrics) => void;
  onDelete: (clientId: string) => void;
}

export const ClientesTable: React.FC<ClientesTableProps> = ({
  clientes,
  sortConfig,
  onSort,
  onWhatsApp,
  onEdit,
  onDelete,
}) => {
  const SortableHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => {
    const isActive = sortConfig?.key === sortKey;
    const direction = sortConfig?.direction;
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50"
        onClick={() => onSort(sortKey)}
      >
        <div className="flex items-center gap-2">
          {label}
          <div className="flex flex-col">
            <ChevronUp
              className={`-mb-1 h-3 w-3 ${
                isActive && direction === 'asc' ? 'text-primary' : 'text-muted-foreground/30'
              }`}
            />
            <ChevronDown
              className={`h-3 w-3 ${
                isActive && direction === 'desc' ? 'text-primary' : 'text-muted-foreground/30'
              }`}
            />
          </div>
        </div>
      </TableHead>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/20">
      <Table>
        <TableHeader>
          <TableRow className={CLIENT_ROW}>
            <SortableHeader label="Nome" sortKey="nome" />
            <SortableHeader label="Total" sortKey="totalFaturado" />
            <SortableHeader label="Pago" sortKey="totalPago" />
            <SortableHeader label="A Receber" sortKey="aReceber" />
            <SortableHeader label="Sessões" sortKey="sessoes" />
            <TableHead className="text-xs text-muted-foreground">Status</TableHead>
            <TableHead className="text-right text-xs text-muted-foreground">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((cliente) => (
            <TableRow key={cliente.id} className={CLIENT_ROW}>
              <TableCell>
                <Link to={`/app/clientes/${cliente.id}`} className={CLIENT_NAME}>
                  {cliente.nome}
                </Link>
                {(cliente as any).origem && (
                  <div className="mt-1">
                    <OriginBadge originId={(cliente as any).origem} />
                  </div>
                )}
              </TableCell>
              <TableCell className={CLIENT_METRIC_VALUE}>
                {formatCurrency(cliente.totalFaturado)}
              </TableCell>
              <TableCell className={CLIENT_METRIC_PAID}>
                {formatCurrency(cliente.totalPago)}
              </TableCell>
              <TableCell className={CLIENT_METRIC_DUE}>
                {formatCurrency(cliente.aReceber)}
              </TableCell>
              <TableCell>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {cliente.sessoes}
                </span>
              </TableCell>
              <TableCell>
                <span className={cliente.totalFaturado > 0 ? STATUS_BADGE_ACTIVE : STATUS_BADGE_NEW}>
                  {cliente.totalFaturado > 0 ? 'Ativo' : 'Novo'}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onWhatsApp(cliente)}
                    className={CLIENT_ICON_ACTION}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(cliente)}
                    className={CLIENT_ICON_ACTION}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(cliente.id)}
                    className={CLIENT_ICON_ACTION_DANGER}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
