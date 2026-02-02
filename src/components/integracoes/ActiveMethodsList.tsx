import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ActiveMethodRow, ProvedorPagamento } from './ActiveMethodRow';

interface ActiveMethod {
  provedor: ProvedorPagamento;
  info: string;
  isPadrao: boolean;
}

interface ActiveMethodsListProps {
  methods: ActiveMethod[];
  onSetPadrao: (provedor: ProvedorPagamento) => void;
  onEdit: (provedor: ProvedorPagamento) => void;
  onDisconnect: (provedor: ProvedorPagamento) => void;
  loading?: boolean;
}

export function ActiveMethodsList({
  methods,
  onSetPadrao,
  onEdit,
  onDisconnect,
  loading,
}: ActiveMethodsListProps) {
  const hasPixManual = methods.some(m => m.provedor === 'pix_manual');

  if (methods.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground border border-dashed border-border rounded-xl">
        <p className="text-sm">Nenhum método de pagamento configurado</p>
        <p className="text-xs mt-1">Configure um provedor abaixo para começar a receber</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">Métodos de Pagamento Ativos</h3>
        <p className="text-xs text-muted-foreground">
          Selecione qual será o método padrão para novas cobranças
        </p>
      </div>

      <div className="space-y-2">
        {methods.map((method) => (
          <ActiveMethodRow
            key={method.provedor}
            provedor={method.provedor}
            info={method.info}
            isPadrao={method.isPadrao}
            onSetPadrao={() => onSetPadrao(method.provedor)}
            onEdit={() => onEdit(method.provedor)}
            onDisconnect={() => onDisconnect(method.provedor)}
            loading={loading}
          />
        ))}
      </div>

      {hasPixManual && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>PIX Manual:</strong> Você precisará confirmar manualmente os pagamentos recebidos por este método.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
