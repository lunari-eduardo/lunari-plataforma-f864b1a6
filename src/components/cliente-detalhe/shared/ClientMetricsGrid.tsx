import { Users, Wallet, CheckCircle2, CalendarClock, Clock, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MetricIconBadge } from "@/components/ui/metric-icon";
import { formatCurrency } from '@/utils/financialUtils';

interface ClientMetrics {
  totalSessoes: number;
  totalFaturado: number;
  totalPago: number;
  agendado: number;
  aReceber: number;
  totalGalerias?: number;
  totalFotosExtras?: number;
  faturamentoExtras?: number;
}

interface ClientMetricsGridProps {
  metrics: ClientMetrics;
}

export function ClientMetricsGrid({ metrics }: ClientMetricsGridProps) {
  const items = [
    { 
      icon: Users, 
      label: 'Sessões', 
      value: String(metrics.totalSessoes || 0),
      subtext: metrics.totalGalerias ? `${metrics.totalGalerias} ${metrics.totalGalerias === 1 ? 'galeria' : 'galerias'}` : undefined
    },
    { 
      icon: Wallet, 
      label: 'Total', 
      value: formatCurrency(Math.max(0, metrics.totalFaturado || 0)) 
    },
    { 
      icon: CheckCircle2, 
      label: 'Pago', 
      value: formatCurrency(Math.max(0, metrics.totalPago || 0)) 
    },
    { 
      icon: CalendarClock, 
      label: 'Agendado', 
      value: formatCurrency(Math.max(0, metrics.agendado || 0)) 
    },
    { 
      icon: Clock, 
      label: 'A Receber', 
      value: formatCurrency(Math.max(0, metrics.aReceber || 0)) 
    },
    {
      icon: Sparkles,
      label: 'Fotos Extras',
      value: `${metrics.totalFotosExtras || 0} ${metrics.totalFotosExtras === 1 ? 'extra' : 'extras'}`,
      subtext: metrics.faturamentoExtras ? formatCurrency(metrics.faturamentoExtras) : undefined
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(({ icon, label, value, subtext }) => (
        <Card
          key={label}
          className="flex items-start justify-between gap-2.5 rounded-xl border-border/20 bg-card p-3 shadow-none min-w-0"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[18px] sm:text-[19px] font-semibold leading-tight tracking-tight tabular-nums text-foreground">
              {value}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
              <span>{label}</span>
              {subtext && (
                <span className="text-[10px] text-accent-gold font-medium truncate">
                  ({subtext})
                </span>
              )}
            </div>
          </div>
          <MetricIconBadge Icon={icon} size="sm" />
        </Card>
      ))}
    </div>
  );
}

