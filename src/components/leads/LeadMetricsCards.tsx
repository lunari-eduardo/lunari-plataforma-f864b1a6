import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Send, CheckCircle, XCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { useLeadMetrics, type PeriodFilter } from '@/hooks/useLeadMetrics';
import { cn } from '@/lib/utils';
export interface LeadMetricsCardsProps {
  periodFilter?: PeriodFilter;
  className?: string;
}
export default function LeadMetricsCards({
  periodFilter,
  className
}: LeadMetricsCardsProps) {
  const {
    metrics,
    topMotivoLabel,
    hasData
  } = useLeadMetrics(periodFilter);
  const cards = [{
    title: 'Total de Leads',
    value: metrics.totalLeads,
    icon: Users,
    color: 'text-lunar-accent',
    bgColor: 'bg-lunar-accent/10'
  }, {
    title: 'Leads Enviados',
    value: metrics.leadsEnviados,
    icon: Send,
    color: 'text-chart-blue-1',
    bgColor: 'bg-chart-blue-1/10'
  }, {
    title: 'Leads Fechados',
    value: metrics.leadsFechados,
    icon: CheckCircle,
    color: 'text-chart-green-1',
    bgColor: 'bg-chart-green-1/10'
  }, {
    title: 'Leads Perdidos',
    value: metrics.leadsPerdidos,
    icon: XCircle,
    color: 'text-chart-red-1',
    bgColor: 'bg-chart-red-1/10'
  }, {
    title: 'Taxa de Conversão',
    value: `${metrics.taxaConversao}%`,
    icon: TrendingUp,
    color: 'text-chart-purple-1',
    bgColor: 'bg-chart-purple-1/10',
    subtitle: metrics.leadsEnviados > 0 ? `${metrics.leadsFechados}/${metrics.leadsEnviados}` : '0/0'
  }, {
    title: 'Top Motivo Perda',
    value: topMotivoLabel || 'N/A',
    icon: AlertTriangle,
    color: 'text-chart-orange-1',
    bgColor: 'bg-chart-orange-1/10',
    isText: true
  }];
  if (!hasData) {
    return <Card className={cn("p-4 bg-lunar-surface border-lunar-border/60", className)}>
        <div className="text-center text-lunar-textSecondary">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum lead encontrado no período selecionado</p>
        </div>
      </Card>;
  }
  return <div className={cn("grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2", className)}>
      {cards.map((card, index) => {
      const Icon = card.icon;
      return <Card key={index} className="bg-lunar-surface border-lunar-border/50 hover:border-lunar-border transition-colors">
            <CardContent className="flex items-center justify-between px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-lunar-textSecondary truncate mb-1">
                  {card.title}
                </p>
                <p className="text-sm font-bold text-lunar-text">
                  {card.isText ? <span className={cn("text-xs", card.value === 'N/A' ? 'text-lunar-textSecondary' : '')}>
                      {card.value}
                    </span> : card.value}
                </p>
              </div>
              <div className={cn("p-1.5 rounded-md flex-shrink-0 ml-2", card.bgColor)}>
                <Icon className={cn("h-3 w-3", card.color)} />
              </div>
            </CardContent>
          </Card>;
    })}
    </div>;
}