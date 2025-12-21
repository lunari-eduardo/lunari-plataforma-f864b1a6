import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QrCode, Link2, CreditCard, Smartphone, XCircle, Eye } from 'lucide-react';
import { Cobranca, TipoCobranca, StatusCobranca } from '@/types/cobranca';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';

interface ChargeHistoryProps {
  cobrancas: Cobranca[];
  onCancel: (id: string) => void;
  onView?: (cobranca: Cobranca) => void;
}

const tipoIcons: Record<TipoCobranca, React.ReactNode> = {
  pix: <QrCode className="h-4 w-4" />,
  link: <Link2 className="h-4 w-4" />,
};

const tipoLabels: Record<TipoCobranca, string> = {
  pix: 'Pix',
  link: 'Link',
};

const statusBadges: Record<StatusCobranca, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pendente: { variant: 'secondary', label: 'Aguardando' },
  pago: { variant: 'default', label: 'Pago' },
  cancelado: { variant: 'outline', label: 'Cancelado' },
  expirado: { variant: 'destructive', label: 'Expirado' },
};

export function ChargeHistory({ cobrancas, onCancel, onView }: ChargeHistoryProps) {
  if (cobrancas.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-sm">Nenhuma cobrança registrada</p>
      </div>
    );
  }

  return (
    <div className="-mx-2 px-2 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Data</TableHead>
            <TableHead className="text-xs">Valor</TableHead>
            <TableHead className="text-xs">Forma</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cobrancas.map((cobranca) => {
            const statusConfig = statusBadges[cobranca.status];
            
            return (
              <TableRow key={cobranca.id}>
                <TableCell className="text-sm">
                  {formatDateForDisplay(cobranca.createdAt)}
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(cobranca.valor)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {tipoIcons[cobranca.tipoCobranca]}
                    <span className="text-xs">{tipoLabels[cobranca.tipoCobranca]}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={statusConfig.variant}
                    className={cobranca.status === 'pago' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                  >
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {onView && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onView(cobranca)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {cobranca.status === 'pendente' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCancel(cobranca.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
