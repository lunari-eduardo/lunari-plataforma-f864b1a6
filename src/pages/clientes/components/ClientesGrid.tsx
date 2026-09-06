import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { ClientMetrics } from '@/hooks/useClientMetrics';
import {
  CLIENT_CARD,
  CLIENT_NAME,
  CLIENT_METRIC_LABEL,
  CLIENT_METRIC_VALUE,
  CLIENT_METRIC_PAID,
  CLIENT_METRIC_DUE,
  STATUS_BADGE_ACTIVE,
  STATUS_BADGE_NEW,
  CLIENT_ICON_ACTION,
  CLIENT_ICON_ACTION_DANGER,
} from '@/components/clientes/clienteTokens';

interface ClientesGridProps {
  clientes: ClientMetrics[];
  onWhatsApp: (cliente: ClientMetrics) => void;
  onEdit: (cliente: ClientMetrics) => void;
  onDelete: (clientId: string) => void;
}

export const ClientesGrid: React.FC<ClientesGridProps> = ({
  clientes,
  onWhatsApp,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {clientes.map((cliente) => (
        <Card key={cliente.id} className={`${CLIENT_CARD} overflow-hidden shadow-none`}>
          <CardContent className="p-4">
            {/* Header do Card */}
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link to={`/app/clientes/${cliente.id}`} className={`${CLIENT_NAME} block truncate`}>
                  {cliente.nome}
                </Link>
              </div>
              <div className="flex shrink-0 gap-1">
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
            </div>

            {/* Métricas Financeiras */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className={`${CLIENT_METRIC_LABEL} mb-1`}>Total</p>
                <p className={CLIENT_METRIC_VALUE}>{formatCurrency(cliente.totalFaturado)}</p>
              </div>
              <div>
                <p className={`${CLIENT_METRIC_LABEL} mb-1`}>Pago</p>
                <p className={CLIENT_METRIC_PAID}>{formatCurrency(cliente.totalPago)}</p>
              </div>
              <div>
                <p className={`${CLIENT_METRIC_LABEL} mb-1`}>A Receber</p>
                <p className={CLIENT_METRIC_DUE}>{formatCurrency(cliente.aReceber)}</p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-3">
              <span className="text-[11px] text-muted-foreground">
                {cliente.sessoes} sessões
              </span>
              <span className={cliente.totalFaturado > 0 ? STATUS_BADGE_ACTIVE : STATUS_BADGE_NEW}>
                {cliente.totalFaturado > 0 ? 'Ativo' : 'Novo'}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
