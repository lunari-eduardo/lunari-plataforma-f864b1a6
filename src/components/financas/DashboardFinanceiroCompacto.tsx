
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Target, Wallet, CreditCard } from 'lucide-react';

interface MetricaProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  color: string;
}

function MetricaCard({ title, value, change, icon, color }: MetricaProps) {
  return (
    <Card className="p-0">
      <CardHeader className="pb-1 pt-2 px-3">
        <CardTitle className="text-xs flex items-center gap-1 text-gray-600">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-2">
        <div className="flex items-center justify-between">
          <p className={`text-lg font-bold ${color}`}>{value}</p>
          {change && (
            <div className={`flex items-center text-xs ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
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
}

export default function DashboardFinanceiroCompacto({
  totalReceita,
  totalDespesas,
  lucroLiquido,
  saldoCaixa,
  metaReceita,
  metaLucro,
  lucratividade
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
          change={8.5}
          icon={<DollarSign className="h-3 w-3 text-green-600" />}
          color="text-green-600"
        />
        <MetricaCard
          title="Total Despesas"
          value={formatCurrency(totalDespesas)}
          change={-2.1}
          icon={<CreditCard className="h-3 w-3 text-red-600" />}
          color="text-red-600"
        />
        <MetricaCard
          title="Lucro Líquido"
          value={formatCurrency(lucroLiquido)}
          change={12.3}
          icon={<TrendingUp className="h-3 w-3 text-blue-600" />}
          color="text-blue-600"
        />
        <MetricaCard
          title="Saldo Caixa"
          value={formatCurrency(saldoCaixa)}
          icon={<Wallet className="h-3 w-3 text-purple-600" />}
          color="text-purple-600"
        />
      </div>

      {/* Métricas de Performance */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Card className="p-0">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs flex items-center gap-1 text-gray-600">
              <Target className="h-3 w-3" />
              Meta Receita
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-2">
            <div className="text-xs text-gray-600 mb-1">
              {formatCurrency(metaReceita)}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min((totalReceita / metaReceita) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {((totalReceita / metaReceita) * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs flex items-center gap-1 text-gray-600">
              <Target className="h-3 w-3" />
              Meta Lucro
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-2">
            <div className="text-xs text-gray-600 mb-1">
              {formatCurrency(metaLucro)}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min((lucroLiquido / metaLucro) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {((lucroLiquido / metaLucro) * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs text-gray-600">
              Lucratividade
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-2">
            <div className="text-2xl font-bold text-blue-600">
              {lucratividade.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">
              Taxa de lucratividade
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
