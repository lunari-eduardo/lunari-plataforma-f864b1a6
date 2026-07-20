import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const getMonthName = (month: number) => MONTH_NAMES[month - 1];

interface Props {
  month: number;
  year: number;
  isPreloading: boolean;
  isChanging?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/**
 * Seletor de mês centralizado.
 *
 * - Enquanto `isChanging`, mostra spinner ao lado do nome do mês (feedback).
 * - Debounce leve nos cliques (100ms) evita disparar múltiplos fetches
 *   quando o usuário clica rápido em Prev/Next.
 */
export function WorkflowMonthSwitcher({
  month, year, isPreloading, isChanging = false, onPrev, onNext, onToday,
}: Props) {
  const lastClickRef = useRef(0);

  const throttled = (fn: () => void) => () => {
    const now = Date.now();
    if (now - lastClickRef.current < 100) return;
    lastClickRef.current = now;
    fn();
  };

  const busy = isChanging || isPreloading;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" onClick={throttled(onPrev)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="font-medium text-lg min-w-[180px] text-center inline-flex items-center justify-center gap-2">
        {getMonthName(month)} {year}
        {busy && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Carregando" />
        )}
      </span>
      <Button variant="outline" size="sm" onClick={throttled(onNext)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={throttled(onToday)}>
        Hoje
      </Button>
    </div>
  );
}
