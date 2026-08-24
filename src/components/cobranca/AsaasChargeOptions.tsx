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
      <div className={cn("grid gap-2.5", hasPix ? "grid-cols-2" : "grid-cols-1")}>
        {/* Card: Link de Checkout */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectMethod('link')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectMethod('link'); } }}
          className={cn(
            "relative p-3 flex flex-col items-center justify-center gap-1.5 rounded-xl border cursor-pointer transition-all text-center select-none",
            selectedMethod === 'link'
              ? "border-primary bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/30"
              : "border-border/80 bg-card/40 hover:bg-muted/40 hover:border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {selectedMethod === 'link' && (
            <div className="absolute top-2 right-2 text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          )}
          <div className={cn(
            "p-1.5 rounded-lg transition-colors",
            selectedMethod === 'link' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <Link2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className={cn("font-semibold text-xs leading-snug", selectedMethod === 'link' ? "text-foreground font-bold" : "text-foreground")}>
              Link de Checkout
            </p>
            <p className="text-[10px] text-muted-foreground font-normal mt-0.5 leading-tight">
              WhatsApp (Pix + Cartão)
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
              "relative p-3 flex flex-col items-center justify-center gap-1.5 rounded-xl border cursor-pointer transition-all text-center select-none",
              selectedMethod === 'pix'
                ? "border-primary bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/30"
                : "border-border/80 bg-card/40 hover:bg-muted/40 hover:border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {selectedMethod === 'pix' && (
              <div className="absolute top-2 right-2 text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            )}
            <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              selectedMethod === 'pix' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <QrCode className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className={cn("font-semibold text-xs leading-snug", selectedMethod === 'pix' ? "text-foreground font-bold" : "text-foreground")}>
                PIX Balcão
              </p>
              <p className="text-[10px] text-muted-foreground font-normal mt-0.5 leading-tight">
                Exibir QR Code na tela
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
