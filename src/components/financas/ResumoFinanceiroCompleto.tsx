
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumoFinanceiro } from "@/types/financas";
import { formatCurrency } from "@/utils/financialUtils";
import { DollarSign, TrendingUp, TrendingDown, Briefcase, Target, Receipt } from "lucide-react";

interface ResumoFinanceiroCompletoProps {
  resumo: ResumoFinanceiro;
}

export default function ResumoFinanceiroCompleto({ resumo }: ResumoFinanceiroCompletoProps) {
  const cards = [
    {
      title: "Total de Receitas Extras",
      value: resumo.totalReceitasExtras,
      icon: <Receipt className="h-5 w-5" />,
      color: "bg-green-500",
      textColor: "text-green-600",
      subtitle: "Receitas não operacionais do mês"
    },
    {
      title: "Total de Despesas",
      value: resumo.totalDespesas,
      icon: <DollarSign className="h-5 w-5" />,
      color: "bg-red-500",
      textColor: "text-red-600",
      subtitle: "Despesas faturadas + pagas"
    },
    {
      title: "Receita Operacional",
      value: resumo.receitaOperacional,
      icon: <Briefcase className="h-5 w-5" />,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      subtitle: "Vinda do Workflow"
    },
    {
      title: "Resultado Mensal",
      value: resumo.resultadoMensal,
      icon: resumo.resultadoMensal >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />,
      color: resumo.resultadoMensal >= 0 ? "bg-emerald-500" : "bg-red-500",
      textColor: resumo.resultadoMensal >= 0 ? "text-emerald-600" : "text-red-600",
      subtitle: "Receitas - Despesas"
    },
    {
      title: "Lucro Líquido do Mês",
      value: resumo.lucroLiquido,
      icon: <Target className="h-5 w-5" />,
      color: resumo.lucroLiquido >= 0 ? "bg-violet-500" : "bg-red-500",
      textColor: resumo.lucroLiquido >= 0 ? "text-violet-600" : "text-red-600",
      highlight: true,
      subtitle: "Resultado final"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card, index) => (
        <Card key={index} className={card.highlight ? "ring-2 ring-violet-200 shadow-lg" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              {card.title}
              {card.subtitle && (
                <div className="text-xs text-gray-500 mt-1 font-normal">
                  {card.subtitle}
                </div>
              )}
            </CardTitle>
            <div className={`${card.color} p-2 rounded-md text-white`}>
              {card.icon}
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${card.textColor}`}>
              {formatCurrency(card.value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
