import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Calendar } from 'lucide-react';

export function SalesMetricsCards() {
  const metrics = [
    {
      title: 'Receita Total',
      value: 'R$ 45.280',
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
      description: 'vs. mês anterior'
    },
    {
      title: 'Conversão',
      value: '68%',
      change: '+5.2%',
      trend: 'up',
      icon: Target,
      description: 'orçamentos → vendas'
    },
    {
      title: 'Ticket Médio',
      value: 'R$ 2.850',
      change: '-3.1%',
      trend: 'down',
      icon: TrendingUp,
      description: 'por sessão'
    },
    {
      title: 'Novos Clientes',
      value: '24',
      change: '+18.7%',
      trend: 'up',
      icon: Users,
      description: 'este mês'
    },
    {
      title: 'Sessões Realizadas',
      value: '16',
      change: '+6.7%',
      trend: 'up',
      icon: Calendar,
      description: 'neste período'
    },
    {
      title: 'Meta Mensal',
      value: '89%',
      change: 'R$ 5.7k restante',
      trend: 'neutral',
      icon: Target,
      description: 'progresso atual'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        const isPositive = metric.trend === 'up';
        const isNegative = metric.trend === 'down';
        
        return (
          <Card key={index} className="border-0 shadow-lg bg-lunar-surface hover:shadow-xl transition-all duration-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Icon className={`h-4 w-4 ${
                  isPositive ? 'text-green-500' : 
                  isNegative ? 'text-red-500' : 
                  'text-lunar-accent'
                }`} />
                {metric.trend !== 'neutral' && (
                  <Badge 
                    variant={isPositive ? 'default' : 'destructive'} 
                    className="text-2xs h-5"
                  >
                    {isPositive ? <TrendingUp className="h-2 w-2 mr-1" /> : <TrendingDown className="h-2 w-2 mr-1" />}
                    {metric.change}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xs font-medium text-lunar-textSecondary">
                {metric.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                <p className="text-lg font-bold text-lunar-text">{metric.value}</p>
                <p className="text-2xs text-lunar-textSecondary">{metric.description}</p>
                {metric.trend === 'neutral' && (
                  <Badge variant="outline" className="text-2xs">
                    {metric.change}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}