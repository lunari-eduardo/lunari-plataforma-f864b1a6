
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumoFinanceiro as ResumoType } from "@/types/financas";
import { formatCurrency } from "@/utils/financialUtils";
import { DollarSign, TrendingUp, TrendingDown, Briefcase, Target } from "lucide-react";

interface ResumoFinanceiroProps {
  resumo: ResumoType;
}

export default function ResumoFinanceiro({ resumo }: ResumoFinanceiroProps) {
  const cards = [
    {
      title: "Custo Total (Faturado)",
      value: resumo.custoTotal,
      icon: <DollarSign className="h-5 w-5" />,
      color: "bg-destructive",
      positive: false,
      subtitle: "Despesas pagas este mês"
    },
    {
      title: "Custo Previsto",
      value: resumo.custoPrevisto,
      icon: <TrendingUp className="h-5 w-5" />,
      color: "bg-lunar-warning",
      positive: false,
      subtitle: "Total planejado para o mês"
    },
    {
      title: "Receitas Extras",
      value: resumo.totalReceitasExtras,
      icon: <DollarSign className="h-5 w-5" />,
      color: "bg-lunar-success",
      positive: true
    },
    {
      title: "Receita Operacional",
      value: resumo.receitaOperacional,
      icon: <Briefcase className="h-5 w-5" />,
      color: "bg-primary",
      positive: true,
      subtitle: "Vinda do Workflow"
    },
    {
      title: "Lucro Líquido",
      value: resumo.lucroLiquido,
      icon: <Target className="h-5 w-5" />,
      color: resumo.lucroLiquido >= 0 ? "bg-primary" : "bg-destructive",
      positive: resumo.lucroLiquido >= 0,
      highlight: true
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card, index) => (
        <Card key={index} className={card.highlight ? "ring-2 ring-primary/20" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              {card.title}
              {card.subtitle && (
                <div className="text-2xs text-neumorphic-textLight mt-1">
                  {card.subtitle}
                </div>
              )}
            </CardTitle>
            <div className={`${card.color} p-2 rounded-md text-lunar-accent-foreground`}>
              {card.icon}
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${card.positive ? 'text-lunar-success' : 'text-destructive'}`}>
              {formatCurrency(card.value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
