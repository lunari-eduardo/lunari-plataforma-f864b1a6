
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Target, Wallet, CreditCard } from 'lucide-react';

interface MetricaProps {
  title: string;
  value: string;
  change?: number | null;
  icon: React.ReactNode;
  color: string;
}

function MetricaCard({ title, value, change, icon, color }: MetricaProps) {
  return (
    <Card className="p-0">
      <CardHeader className="pb-1 pt-2 px-3">
        <CardTitle className="text-xs flex items-center gap-1 text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-2">
        <div className="flex items-center justify-between">
          <p className={`text-lg font-bold ${color}`}>{value}</p>
          {change !== null && change !== undefined && (
            <div className={`flex items-center text-xs ${change > 0 ? 'text-lunar-success' : 'text-lunar-error'}`}>
              {change > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardFinanceiroCompactoProps {
  totalReceita: number;
  totalDespesas: number;
  lucroLiquido: number;
  saldoCaixa: number;
  metaReceita: number;
  metaLucro: number;
  lucratividade: number;
  variacaoReceita?: number | null;
  variacaoLucro?: number | null;
  variacaoDespesas?: number | null;
}

export default function DashboardFinanceiroCompacto({
  totalReceita,
  totalDespesas,
  lucroLiquido,
  saldoCaixa,
  metaReceita,
  metaLucro,
  lucratividade,
  variacaoReceita,
  variacaoLucro,
  variacaoDespesas
}: DashboardFinanceiroCompactoProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-3">
      {/* Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricaCard
          title="Total Receita"
          value={formatCurrency(totalReceita)}
          change={variacaoReceita}
          icon={<DollarSign className="h-3 w-3 text-[hsl(var(--chart-revenue))]" />}
          color="text-[hsl(var(--chart-revenue))]"
        />
        <MetricaCard
          title="Total Despesas"
          value={formatCurrency(totalDespesas)}
          change={variacaoDespesas}
          icon={<CreditCard className="h-3 w-3 text-lunar-error" />}
          color="text-lunar-error"
        />
        <MetricaCard
          title="Lucro Líquido"
          value={formatCurrency(lucroLiquido)}
          change={variacaoLucro}
          icon={<TrendingUp className="h-3 w-3 text-primary" />}
          color="text-primary"
        />
        <MetricaCard
          title="Saldo Caixa"
          value={formatCurrency(saldoCaixa)}
          icon={<Wallet className="h-3 w-3 text-chart-tertiary" />}
          color="text-chart-tertiary"
        />
      </div>

      {/* Métricas de Performance */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Card className="p-0">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs flex items-center gap-1 text-muted-foreground">
              <Target className="h-3 w-3" />
              Meta Receita
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-2">
            <div className="text-xs text-muted-foreground mb-1">
              {formatCurrency(metaReceita)}
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-lunar-success h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min((totalReceita / metaReceita) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {((totalReceita / metaReceita) * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs flex items-center gap-1 text-muted-foreground">
              <Target className="h-3 w-3" />
              Meta Lucro
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-2">
            <div className="text-xs text-muted-foreground mb-1">
              {formatCurrency(metaLucro)}
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min((lucroLiquido / metaLucro) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {((lucroLiquido / metaLucro) * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs text-muted-foreground">
              Lucratividade
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-2">
            <div className="text-2xl font-bold text-primary">
              {lucratividade.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              Taxa de lucratividade
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
