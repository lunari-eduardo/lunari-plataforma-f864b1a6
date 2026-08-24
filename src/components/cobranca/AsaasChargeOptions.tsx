import { QrCode, Link2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AsaasChargeOptionsProps {
  valor: number;
  selectedMethod: 'link' | 'pix';
  onSelectMethod: (method: 'link' | 'pix') => void;
  hasPix: boolean;
}

export function AsaasChargeOptions({
  selectedMethod,
  onSelectMethod,
  hasPix,
}: AsaasChargeOptionsProps) {
  return (
    <div className="space-y-2">
      <div className={cn("grid gap-3", hasPix ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        {/* Card: Link de Checkout */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectMethod('link')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectMethod('link'); } }}
          className={cn(
            "relative p-3.5 flex flex-col items-center justify-center gap-2 rounded-xl border cursor-pointer transition-all text-center select-none",
            selectedMethod === 'link'
              ? "border-primary bg-primary/10 text-foreground shadow-sm ring-2 ring-primary/20"
              : "border-border/80 bg-card/40 hover:bg-muted/40 hover:border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {selectedMethod === 'link' && (
            <div className="absolute top-2.5 right-2.5 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          )}
          <div className={cn(
            "p-2 rounded-lg transition-colors",
            selectedMethod === 'link' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <Link2 className="h-4 w-4" />
          </div>
          <div>
            <p className={cn("font-semibold text-xs sm:text-sm leading-snug", selectedMethod === 'link' ? "text-foreground font-bold" : "text-foreground")}>
              Gerar Link de Checkout
            </p>
            <p className="text-[10px] text-muted-foreground font-normal mt-0.5">
              Enviar por WhatsApp (Pix + Cartão)
            </p>
          </div>
        </div>

        {/* Card: PIX Presencial */}
        {hasPix && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectMethod('pix')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectMethod('pix'); } }}
            className={cn(
              "relative p-3.5 flex flex-col items-center justify-center gap-2 rounded-xl border cursor-pointer transition-all text-center select-none",
              selectedMethod === 'pix'
                ? "border-primary bg-primary/10 text-foreground shadow-sm ring-2 ring-primary/20"
                : "border-border/80 bg-card/40 hover:bg-muted/40 hover:border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {selectedMethod === 'pix' && (
              <div className="absolute top-2.5 right-2.5 text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            )}
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              selectedMethod === 'pix' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <QrCode className="h-4 w-4" />
            </div>
            <div>
              <p className={cn("font-semibold text-xs sm:text-sm leading-snug", selectedMethod === 'pix' ? "text-foreground font-bold" : "text-foreground")}>
                PIX Presencial (Balcão)
              </p>
              <p className="text-[10px] text-muted-foreground font-normal mt-0.5">
                Exibir QR Code na tela agora
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
