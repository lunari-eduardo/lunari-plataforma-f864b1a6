import { DollarSign, BarChart3, Users, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/utils/financialUtils";

interface KPIGroupCardProps {
  receitaMes: number;
  metaMes: number;
  progressoMeta: number; // 0-100
  topCategoria: { name: string; revenue: number; sessions: number } | null;
  novosClientes60d: number;
  livresSemana: number;
  proximoLivre: Date | null;
}

export function KPIGroupCard({
  receitaMes,
  metaMes,
  progressoMeta,
  topCategoria,
  novosClientes60d,
  livresSemana,
  proximoLivre,
}: KPIGroupCardProps) {
  return (
    <Card className="rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Indicadores principais</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Receita vs Meta */}
            <div className="relative rounded-xl border-0 bg-card-gradient shadow-none hover:shadow-card-subtle transition-shadow duration-300 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-lunar-textSecondary font-medium">Receita do mês</span>
               <div className="p-2 rounded-lg bg-brand-gradient">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="text-lg font-semibold">{formatCurrency(receitaMes)}</p>
              <span className="text-2xs text-lunar-textSecondary">Meta: {formatCurrency(metaMes)}</span>
            </div>
            <div className="mt-2">
              <Progress value={progressoMeta} />
              <span className="text-2xs text-lunar-textSecondary">{progressoMeta.toFixed(0)}%</span>
            </div>
          </div>

          {/* Categoria mais rentável */}
          <div className="relative rounded-xl border-0 bg-card-gradient shadow-none hover:shadow-card-subtle transition-shadow duration-300 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-lunar-textSecondary font-medium">Categoria mais rentável</span>
               <div className="p-2 rounded-lg bg-brand-gradient">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
            </div>
            {topCategoria ? (
              <div className="mt-1">
                <p className="text-lg font-semibold">{topCategoria.name}</p>
                <p className="text-2xs text-lunar-textSecondary mt-1">
                  Receita: {formatCurrency(topCategoria.revenue)} • {topCategoria.sessions} sessões
                </p>
              </div>
            ) : (
              <p className="mt-1 text-2xs text-lunar-textSecondary">Sem dados</p>
            )}
          </div>

          {/* Novos clientes 60d */}
          <div className="relative rounded-xl border-0 bg-card-gradient shadow-none hover:shadow-card-subtle transition-shadow duration-300 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-lunar-textSecondary font-medium">Novos clientes (60 dias)</span>
               <div className="p-2 rounded-lg bg-brand-gradient">
                <Users className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="mt-1 text-lg font-semibold">{novosClientes60d}</p>
            <p className="text-2xs text-lunar-textSecondary mt-1">Primeira sessão registrada</p>
          </div>

          {/* Horários livres 7d */}
          <div className="relative rounded-xl border-0 bg-card-gradient shadow-none hover:shadow-card-subtle transition-shadow duration-300 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-lunar-textSecondary font-medium">Horários livres (7 dias)</span>
              <div className="p-2 rounded-lg bg-brand-gradient">
                <Clock className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="mt-1 text-lg font-semibold">{livresSemana}</p>
            <p className="text-2xs text-lunar-textSecondary mt-1">
              {proximoLivre ? (
                <>Próximo: {proximoLivre.toLocaleDateString("pt-BR")} • {proximoLivre.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
              ) : (
                <>
                  Sem horários livres. <Link to="/agenda" className="underline">Configurar disponibilidade</Link>
                </>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
