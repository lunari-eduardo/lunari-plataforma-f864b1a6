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
    {
      title: 'Faturamento Total',
      value: formatCurrency(kpis.faturamentoTotal),
      icon: DollarSign,
      color: 'text-emerald-500'
    },
    {
      title: 'Ticket Médio',
      value: formatCurrency(kpis.ticketMedio),
      icon: Receipt,
      color: 'text-blue-500'
    },
    {
      title: 'Fotógrafos Ativos',
      value: kpis.fotografosAtivos.toString(),
      icon: Users,
      color: 'text-violet-500'
    },
    {
      title: 'Crescimento',
      value: formatPercentage(kpis.crescimentoPercentual),
      icon: TrendingUp,
      color: kpis.crescimentoPercentual >= 0 ? 'text-emerald-500' : 'text-red-500'
    }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{card.title}</p>
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            </div>
            <card.icon className={`h-8 w-8 ${card.color} opacity-80`} />
          </div>
        </Card>
      ))}
    </div>
  );
}
