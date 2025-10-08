import { Card } from "@/components/ui/card";
import { formatCurrency } from '@/utils/financialUtils';

interface ClientMetrics {
  totalSessoes: number;
  totalFaturado: number;
  agendado: number;
  aReceber: number;
}

interface ClientMetricsGridProps {
  metrics: ClientMetrics;
}

export function ClientMetricsGrid({ metrics }: ClientMetricsGridProps) {
  // Garantir que valores nunca sejam negativos
  const totalFaturado = Math.max(0, metrics.totalFaturado || 0);
  const agendado = Math.max(0, metrics.agendado || 0);
  const aReceber = Math.max(0, metrics.aReceber || 0);
  
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:gap-2 md:justify-end">
      <Card className="p-2">
        <div className="text-center">
          <div className="text-sm md:text-lg font-bold text-primary">{metrics.totalSessoes || 0}</div>
          <div className="text-[11px] md:text-xs text-muted-foreground">Sessões</div>
        </div>
      </Card>
      <Card className="p-2">
        <div className="text-center">
          <div className="text-sm md:text-lg font-bold text-green-600">{formatCurrency(totalFaturado)}</div>
          <div className="text-[11px] md:text-xs text-muted-foreground">Total</div>
        </div>
      </Card>
      <Card className="p-2">
        <div className="text-center">
          <div className="text-sm md:text-lg font-bold text-blue-600">{formatCurrency(agendado)}</div>
          <div className="text-[11px] md:text-xs text-muted-foreground">Agendado</div>
        </div>
      </Card>
      <Card className="p-2">
        <div className="text-center">
          <div className="text-sm md:text-lg font-bold text-orange-600">{formatCurrency(aReceber)}</div>
          <div className="text-[11px] md:text-xs text-muted-foreground">A Receber</div>
        </div>
      </Card>
    </div>
  );
}