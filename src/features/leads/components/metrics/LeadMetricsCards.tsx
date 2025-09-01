import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Send, CheckCircle, XCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { useLeadMetrics, type PeriodFilter } from '@/hooks/useLeadMetrics';
import { cn } from '@/lib/utils';

export interface LeadMetricsCardsProps {
  periodFilter?: PeriodFilter;
  className?: string;
  isMobile?: boolean;
  isCollapsed?: boolean;
}

export default function LeadMetricsCards({
  periodFilter,
  className,
  isMobile = false,
  isCollapsed = false
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
    return <Card className={cn(
      "bg-lunar-surface border-lunar-border/60", 
      isMobile ? "p-3" : "p-4",
      className
    )}>
        <div className="text-center text-lunar-textSecondary">
          <Users className={cn("mx-auto mb-2 opacity-50", isMobile ? "h-6 w-6" : "h-8 w-8")} />
          <p className={cn(isMobile ? "text-xs" : "text-sm")}>Nenhum lead encontrado no período selecionado</p>
        </div>
      </Card>;
  }

  return <div className={cn(
    "grid gap-2", 
    isMobile 
      ? "grid-cols-2 sm:grid-cols-3" 
      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-6",
    className
  )}>
      {cards.map((card, index) => {
      const Icon = card.icon;
      return <Card key={index} className="bg-lunar-surface border-lunar-border/50 hover:border-lunar-border transition-colors">
            <CardContent className={cn(
              "flex items-center justify-between",
              isMobile ? "px-2 py-1.5" : "px-3 py-2"
            )}>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-lunar-textSecondary truncate mb-1",
                  isMobile ? "text-[10px]" : "text-xs"
                )}>
                  {card.title}
                </p>
                <p className={cn(
                  "font-bold text-lunar-text",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {card.isText ? <span className={cn(
                    isMobile ? "text-[10px]" : "text-xs", 
                    card.value === 'N/A' ? 'text-lunar-textSecondary' : ''
                  )}>
                      {card.value}
                    </span> : card.value}
                </p>
              </div>
              <div className={cn(
                "rounded-md flex-shrink-0 ml-2", 
                isMobile ? "p-1" : "p-1.5",
                card.bgColor
              )}>
                <Icon className={cn(
                  card.color,
                  isMobile ? "h-2.5 w-2.5" : "h-3 w-3"
                )} />
              </div>
            </CardContent>
          </Card>;
    })}
    </div>;
}