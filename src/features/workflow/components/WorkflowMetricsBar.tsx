import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface Financials {
  totalMonth: number;
  paidMonth: number;
  remainingMonth: number;
}

interface Props {
  showMetrics: boolean;
  onToggle: (next: boolean) => void;
  financials: Financials;
  sessionCount: number;
}

const formatCurrency = (value: unknown) =>
  `R$ ${(Number(value) || 0).toFixed(2).replace(".", ",")}`;

/**
 * Onda 5a — barra de métricas compacta extraída do Workflow.tsx.
 * Mantém glassmorphism, cores e badges originais.
 */
export function WorkflowMetricsBar({ showMetrics, onToggle, financials, sessionCount }: Props) {
  if (!showMetrics) {
    return (
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggle(true)}
          className="h-7 px-2 text-xs text-muted-foreground gap-1.5"
        >
          <Eye className="h-3.5 w-3.5" />
          Mostrar métricas
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 sm:gap-5 flex-wrap bg-card/30 backdrop-blur-lg dark:bg-card/[0.04] border border-white/50 dark:border-white/10 rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground">Receita</span>
        <span className="text-sm font-bold text-green-500">{formatCurrency(financials.paidMonth)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground">Previsto</span>
        <span className="text-sm font-bold text-blue-500">{formatCurrency(financials.totalMonth)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${financials.remainingMonth < 0 ? "bg-yellow-500" : "bg-orange-500"}`}
        />
        <span className="text-[11px] text-muted-foreground">
          {financials.remainingMonth < 0 ? "Crédito" : "A Receber"}
        </span>
        <span
          className={`text-sm font-bold ${financials.remainingMonth < 0 ? "text-yellow-500" : "text-orange-500"}`}
        >
          {financials.remainingMonth < 0
            ? `+${formatCurrency(Math.abs(financials.remainingMonth))}`
            : formatCurrency(financials.remainingMonth)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground">Sessões</span>
        <span className="text-sm font-bold">{sessionCount}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onToggle(false)}
        className="h-7 w-7 shrink-0 ml-auto"
        title="Ocultar métricas"
      >
        <EyeOff className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
