import { QrCode, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AsaasChargeOptionsProps {
  valor: number;
  onSelectPix: () => void;
  onSelectLink: () => void;
  pixLoading?: boolean;
  linkLoading?: boolean;
  hasPix: boolean;
}

export function AsaasChargeOptions({
  onSelectPix,
  onSelectLink,
  pixLoading,
  linkLoading,
  hasPix,
}: AsaasChargeOptionsProps) {
  return (
    <div className="space-y-3">
      <div className={cn("grid gap-3", hasPix ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        <Button
          type="button"
          variant="default"
          className="h-auto py-3 px-3.5 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:scale-[1.01]"
          onClick={onSelectLink}
          disabled={linkLoading || pixLoading}
        >
          {linkLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <div className="p-1 rounded-md bg-primary-foreground/15 text-primary-foreground">
              <Link2 className="h-4 w-4" />
            </div>
          )}
          <div className="text-center">
            <p className="font-semibold text-xs sm:text-sm leading-snug">Gerar Link de Checkout</p>
            <p className="text-[10px] opacity-80 font-normal">Enviar por WhatsApp (Pix + Cartão)</p>
          </div>
        </Button>

        {hasPix && (
          <Button
            type="button"
            variant="outline"
            className="h-auto py-3 px-3.5 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/50 hover:bg-accent/40 hover:border-primary/40 transition-all hover:scale-[1.01]"
            onClick={onSelectPix}
            disabled={pixLoading || linkLoading}
          >
            {pixLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <div className="p-1 rounded-md bg-primary/10 text-primary">
                <QrCode className="h-4 w-4" />
              </div>
            )}
            <div className="text-center">
              <p className="font-semibold text-xs sm:text-sm text-foreground leading-snug">PIX Presencial (Balcão)</p>
              <p className="text-[10px] text-muted-foreground font-normal">Exibir QR Code na tela agora</p>
            </div>
          </Button>
        )}
      </div>
    </div>
  );
}
