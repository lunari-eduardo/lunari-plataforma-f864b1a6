import { memo } from 'react';
import { Card } from '@/components/ui/card';
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

export const ClientMetricsGrid = memo(({ metrics }: ClientMetricsGridProps) => {
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:gap-2 md:justify-end">
      <Card className="p-2">
        <div className="text-center">
          <div className="text-sm md:text-lg font-bold text-primary">
            {metrics.totalSessoes}
          </div>
          <div className="text-[11px] md:text-xs text-muted-foreground">
            Sessões
          </div>
        </div>
      </Card>
      
      <Card className="p-2">
        <div className="text-center">
          <div className="text-sm md:text-lg font-bold text-green-600">
            {formatCurrency(metrics.totalFaturado)}
          </div>
          <div className="text-[11px] md:text-xs text-muted-foreground">
            Total
          </div>
        </div>
      </Card>
      
      <Card className="p-2">
        <div className="text-center">
          <div className="text-sm md:text-lg font-bold text-blue-600">
            {formatCurrency(metrics.agendado)}
          </div>
          <div className="text-[11px] md:text-xs text-muted-foreground">
            Agendado
          </div>
        </div>
      </Card>
      
      <Card className="p-2">
        <div className="text-center">
          <div className="text-sm md:text-lg font-bold text-orange-600">
            {formatCurrency(metrics.aReceber)}
          </div>
          <div className="text-[11px] md:text-xs text-muted-foreground">
            A Receber
          </div>
        </div>
      </Card>
    </div>
  );
});

ClientMetricsGrid.displayName = 'ClientMetricsGrid';