import { QrCode, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AsaasChargeOptionsProps {
  valor: number;
  onSelectPix: () => void;
  onSelectLink: () => void;
  pixLoading?: boolean;
  linkLoading?: boolean;
  hasPix: boolean;
}

export function AsaasChargeOptions({
  valor,
  onSelectPix,
  onSelectLink,
  pixLoading,
  linkLoading,
  hasPix,
}: AsaasChargeOptionsProps) {
  return (
    <div className="space-y-4">
      <div className="text-center pb-1">
        <p className="text-2xl font-bold text-primary">R$ {valor.toFixed(2)}</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {hasPix && (
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 border-2 hover:border-primary/50 hover:bg-primary/5"
            onClick={onSelectPix}
            disabled={pixLoading}
          >
            {pixLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <QrCode className="h-6 w-6 text-primary" />
            )}
            <div className="text-center">
              <p className="font-semibold text-sm">PIX — QR Code</p>
              <p className="text-xs text-muted-foreground">Cobrança presencial com QR Code</p>
            </div>
          </Button>
        )}

        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 border-2 hover:border-primary/50 hover:bg-primary/5"
          onClick={onSelectLink}
          disabled={linkLoading}
        >
          {linkLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <Link2 className="h-6 w-6 text-primary" />
          )}
          <div className="text-center">
            <p className="font-semibold text-sm">Gerar Link de Checkout</p>
            <p className="text-xs text-muted-foreground">Envie por WhatsApp — PIX, Cartão e Boleto</p>
          </div>
        </Button>
      </div>
    </div>
  );
}
