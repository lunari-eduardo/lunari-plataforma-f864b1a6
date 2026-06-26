import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const getMonthName = (month: number) => MONTH_NAMES[month - 1];

interface Props {
  month: number;
  year: number;
  isPreloading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/**
 * Onda 5a — seletor de mês centralizado extraído do Workflow.tsx.
 */
export function WorkflowMonthSwitcher({ month, year, isPreloading, onPrev, onNext, onToday }: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="font-medium text-lg min-w-[160px] text-center">
        {getMonthName(month)} {year}
      </span>
      {isPreloading && (
        <Badge variant="outline" className="absolute">
          ⏳
        </Badge>
      )}
      <Button variant="outline" size="sm" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onToday}>
        Hoje
      </Button>
    </div>
  );
}
