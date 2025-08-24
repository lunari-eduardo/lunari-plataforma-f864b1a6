import { DollarSign, BarChart3, Users, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/utils/financialUtils";
import { useIsTablet } from "@/hooks/useIsTablet";
interface KPIGroupCardProps {
  receitaMes: number;
  metaMes: number;
  progressoMeta: number; // 0-100
  topCategoria: {
    name: string;
    revenue: number;
    sessions: number;
  } | null;
  novosClientes60d: number;
  livresSemana: number;
  proximoLivre: Date | null;
  valorPrevisto: number;
}
export function KPIGroupCard({
  receitaMes,
  metaMes,
  progressoMeta,
  topCategoria,
  novosClientes60d,
  livresSemana,
  proximoLivre,
  valorPrevisto
}: KPIGroupCardProps) {
  const isTablet = useIsTablet();

  // Definir os cards como componentes reutilizáveis
  const revenueCard = <div className={`dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 h-full ${isTablet ? 'p-6' : 'p-4'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-lunar-textSecondary font-medium">Receita do mês</span>
        <div className="p-2 rounded-lg bg-brand-gradient">
          <DollarSign className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <p className={`font-semibold ${isTablet ? 'text-2xl' : 'text-lg'}`}>{formatCurrency(receitaMes)}</p>
        <span className="text-xs text-lunar-textSecondary">Meta: {formatCurrency(metaMes)}</span>
      </div>
      <div className="mt-3">
        <Progress value={progressoMeta} className="h-2" />
        <span className="text-xs text-lunar-textSecondary mt-1 block">{progressoMeta.toFixed(0)}% da meta</span>
      </div>
    </div>;
  const categoryCard = <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-lunar-textSecondary font-medium">Categoria mais rentável</span>
        <div className="p-2 rounded-lg bg-brand-gradient">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        {topCategoria ? <div>
            <p className="text-lg font-semibold">{topCategoria.name}</p>
            <p className="text-2xs text-lunar-textSecondary mt-1">
              Receita: {formatCurrency(topCategoria.revenue)} • {topCategoria.sessions} sessões
            </p>
          </div> : <p className="text-2xs text-lunar-textSecondary">Sem dados</p>}
      </div>
    </div>;
  const clientsCard = <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-lunar-textSecondary font-medium">Novos clientes (60 dias)</span>
        <div className="p-2 rounded-lg bg-brand-gradient">
          <Users className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-lg font-semibold">{novosClientes60d}</p>
        <p className="text-2xs text-lunar-textSecondary mt-1">Primeira sessão registrada</p>
      </div>
    </div>;
  const availabilityCard = <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-lunar-textSecondary font-medium">Horários livres (7 dias)</span>
        <div className="p-2 rounded-lg bg-brand-gradient">
          <Clock className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-lg font-semibold">{livresSemana}</p>
        <p className="text-2xs text-lunar-textSecondary mt-1">
          {proximoLivre ? <>Próximo: {proximoLivre.toLocaleDateString("pt-BR")} • {proximoLivre.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
          })}</> : <>
              Sem horários livres. <Link to="/agenda" className="underline">Configurar disponibilidade</Link>
            </>}
        </p>
      </div>
    </div>;
  const forecastCard = <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-lunar-textSecondary font-medium">Total Previsto</span>
        <div className="p-2 rounded-lg bg-brand-gradient">
          <DollarSign className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="flex-1 flex items-center">
        <div className="text-2xl font-bold text-lunar-text">
          {formatCurrency(valorPrevisto)}
        </div>
      </div>
    </div>;
  return <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
      <CardHeader className="pb-4">
        <CardTitle className="font-semibold text-base">Indicadores principais</CardTitle>
      </CardHeader>
      <CardContent>
        {isTablet ?
      // Layout otimizado para tablets: Receita em destaque + grid 2x2
      <div className="space-y-4">
            {/* Primeira linha: Receita do mês em destaque */}
            <div className="w-full">{revenueCard}</div>
            
            {/* Segunda seção: Grid 2x2 com altura uniforme */}
            <div className="grid grid-cols-2 gap-4 auto-rows-fr">
              <div className="h-full">{categoryCard}</div>
              <div className="h-full">{clientsCard}</div>
              <div className="h-full">{availabilityCard}</div>
              <div className="h-full">{forecastCard}</div>
            </div>
          </div> :
      // Layout padrão: Mobile (1 col) e Desktop (5 cols)
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {revenueCard}
            {categoryCard}
            {clientsCard}
            {availabilityCard}
            {forecastCard}
          </div>}
      </CardContent>
    </Card>;
}