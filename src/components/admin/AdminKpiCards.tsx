import { Card } from '@/components/ui/card';
import { DollarSign, Users, TrendingUp, Receipt } from 'lucide-react';
import type { AdminKpis } from '@/types/admin-analytics';

interface AdminKpiCardsProps {
  kpis: AdminKpis;
}

export function AdminKpiCards({ kpis }: AdminKpiCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const cards = [
    { title: 'Faturamento Total', value: formatCurrency(kpis.faturamentoTotal), icon: DollarSign },
    { title: 'Ticket Médio', value: formatCurrency(kpis.ticketMedio), icon: Receipt },
    { title: 'Fotógrafos Ativos', value: kpis.fotografosAtivos.toString(), icon: Users },
    { title: 'Crescimento', value: formatPercentage(kpis.crescimentoPercentual), icon: TrendingUp },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="p-4 border-border/20 bg-card/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.title}</p>
              <p className="text-2xl font-semibold mt-1 tabular-nums">{card.value}</p>
            </div>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </Card>
      ))}
    </div>
  );
}
