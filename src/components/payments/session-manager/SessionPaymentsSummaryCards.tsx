import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/utils/financialUtils';

interface SessionPaymentsSummaryCardsProps {
  isCard: boolean;
  gridCols: string;
  showTotalChip: boolean;
  showExtrasChip: boolean;
  showCobradoChip: boolean;
  valorTotal: number;
  fin: {
    baseSessao: number;
    extrasIdeal: number;
    extrasPago: number;
    extrasPend: number;
  };
  totalPago: number;
  totalRecebido: number;
  totalTaxas: number;
  totalAgendado: number;
  valorRestante: number;
}

export function SessionPaymentsSummaryCards({
  isCard,
  gridCols,
  showTotalChip,
  showExtrasChip,
  showCobradoChip,
  valorTotal,
  fin,
  totalPago,
  totalRecebido,
  totalTaxas,
  totalAgendado,
  valorRestante,
}: SessionPaymentsSummaryCardsProps) {
  return (
    <Card className={isCard ? 'mb-3 border-0 bg-transparent shadow-none' : 'mb-6'}>
      <CardContent className={isCard ? 'p-0 pb-3 border-b border-border/20' : 'pt-6'}>
        <div className={`grid ${gridCols} gap-2 sm:gap-3 lg:gap-4 text-center`}>
          {showTotalChip && (
            <div>
              <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="font-bold text-primary text-xs sm:text-sm">{formatCurrency(valorTotal)}</p>
            </div>
          )}
          {showExtrasChip && (
            <>
              <div>
                <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Base sessão</p>
                <p className="font-semibold text-foreground text-xs sm:text-sm">{formatCurrency(fin.baseSessao)}</p>
              </div>
              <div>
                <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Extras</p>
                <p className="font-semibold text-accent-gold text-xs sm:text-sm">
                  {formatCurrency(fin.extrasIdeal)}
                </p>
                <p className="text-2xs text-muted-foreground">
                  Pago {formatCurrency(fin.extrasPago)} · Pend {formatCurrency(fin.extrasPend)}
                </p>
              </div>
            </>
          )}
          {showCobradoChip && (
            <div>
              <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Cobrado</p>
              <p className="font-bold text-emerald-600 dark:text-emerald-500 text-xs sm:text-sm">{formatCurrency(totalPago)}</p>
            </div>
          )}
          <div>
            <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Recebido</p>
            <p className="font-bold text-emerald-700 dark:text-emerald-500 text-xs sm:text-sm">{formatCurrency(totalRecebido)}</p>
            {totalTaxas > 0 && (
              <p className="text-2xs text-destructive">Taxas: -{formatCurrency(totalTaxas)}</p>
            )}
          </div>
          <div>
            <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Agendado</p>
            <p className="font-bold text-orange-500 text-xs sm:text-sm">{formatCurrency(totalAgendado)}</p>
          </div>
          <div>
            <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Pendente</p>
            <p className={`font-bold text-xs sm:text-sm ${valorRestante > 0.001 ? 'text-accent-gold' : 'text-muted-foreground'}`}>{formatCurrency(valorRestante)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
