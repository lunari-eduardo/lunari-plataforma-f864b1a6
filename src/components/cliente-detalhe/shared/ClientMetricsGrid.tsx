import { Users, Wallet, CheckCircle2, CalendarClock, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MetricIconBadge } from "@/components/ui/metric-icon";
import { formatCurrency } from '@/utils/financialUtils';

interface ClientMetrics {
  totalSessoes: number;
  totalFaturado: number;
  totalPago: number;
  agendado: number;
  aReceber: number;
}

interface ClientMetricsGridProps {
  metrics: ClientMetrics;
}

export function ClientMetricsGrid({ metrics }: ClientMetricsGridProps) {
  const items = [
    { icon: Users, label: 'Sessões', value: String(metrics.totalSessoes || 0) },
    { icon: Wallet, label: 'Total', value: formatCurrency(Math.max(0, metrics.totalFaturado || 0)) },
    { icon: CheckCircle2, label: 'Pago', value: formatCurrency(Math.max(0, metrics.totalPago || 0)) },
    { icon: CalendarClock, label: 'Agendado', value: formatCurrency(Math.max(0, metrics.agendado || 0)) },
    { icon: Clock, label: 'A Receber', value: formatCurrency(Math.max(0, metrics.aReceber || 0)) },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {items.map(({ icon, label, value }) => (
        <Card
          key={label}
          className="flex items-start gap-3 rounded-xl border-border/20 bg-card p-3 shadow-none"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[20px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
              {value}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">{label}</div>
          </div>
          <MetricIconBadge Icon={icon} size="sm" />
        </Card>
      ))}
    </div>
  );
}
