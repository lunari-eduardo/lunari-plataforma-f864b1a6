import { Button } from '@/components/ui/button';
import { CreditCard, ExternalLink } from 'lucide-react';
import { ChargeStatusDisplay, ChargeLoadingStatus } from './ChargeStatusDisplay';
import { formatCurrency } from '@/utils/financialUtils';

interface ChargeCardSectionProps {
  valor: number;
  checkoutUrl?: string;
  status?: 'pendente' | 'pago' | 'cancelado' | 'expirado';
  loading?: boolean;
  onGenerate: () => void;
}

export function ChargeCardSection({
  valor,
  checkoutUrl,
  status,
  loading,
  onGenerate,
}: ChargeCardSectionProps) {

  const handleOpenCheckout = () => {
    if (!checkoutUrl) return;
    window.open(checkoutUrl, '_blank');
  };

  // If already generated, show checkout link
  if (checkoutUrl) {
    return (
      <div className="space-y-4">
        {/* Status */}
        {status && (
          <div className="flex justify-center">
            <ChargeStatusDisplay status={status} />
          </div>
        )}

        <div className="text-center py-4">
          <CreditCard className="h-12 w-12 mx-auto text-primary mb-4" />
          <p className="text-sm text-muted-foreground">
            Checkout pronto para pagamento
          </p>
        </div>

        <Button
          type="button"
          onClick={handleOpenCheckout}
          className="w-full gap-2"
          size="lg"
        >
          <ExternalLink className="h-5 w-5" />
          Abrir Checkout
        </Button>

        {/* Info */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
          <p className="text-sm text-purple-700">
            Cliente será direcionado para checkout seguro
          </p>
        </div>
      </div>
    );
  }

  // Not generated yet
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <ChargeLoadingStatus />
          <p className="text-sm text-muted-foreground">Gerando checkout...</p>
        </div>
      ) : (
        <>
          <div className="text-center py-4">
            <CreditCard className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">
              Pagamento imediato de <strong>{formatCurrency(valor)}</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cliente será redirecionado para checkout seguro
            </p>
          </div>
          
          <Button
            type="button"
            onClick={onGenerate}
            className="w-full gap-2"
            size="lg"
          >
            <CreditCard className="h-5 w-5" />
            Gerar Checkout
          </Button>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
            <p className="text-sm text-purple-700">
              Pagamento via cartão de crédito ou débito
            </p>
          </div>
        </>
      )}
    </div>
  );
}
