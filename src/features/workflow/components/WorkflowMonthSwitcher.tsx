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
  /** true quando NÃO há dado visível — spinner completo (cold load). */
  isColdLoading?: boolean;
  /** true quando há dado visível mas revalidando em background — dot sutil. */
  isRevalidating?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onHoverPrev?: () => void;
  onHoverNext?: () => void;
}

/**
 * Seletor de mês centralizado.
 *
 * Feedback visual distinto para cold-load vs revalidação silenciosa:
 * - Cold: Loader2 girando.
 * - Revalidando: dot pulsante 6px, cor muted — não bloqueia leitura.
 * Debounce 100ms nos cliques para evitar spam de fetches.
 */
export function WorkflowMonthSwitcher({
  month, year, isPreloading, isColdLoading = false, isRevalidating = false,
  onPrev, onNext, onToday, onHoverPrev, onHoverNext,
}: Props) {
  const lastClickRef = useRef(0);

  const throttled = (fn: () => void) => () => {
    const now = Date.now();
    if (now - lastClickRef.current < 100) return;
    lastClickRef.current = now;
    fn();
  };

  const cold = isColdLoading || isPreloading;
  const hint = !cold && isRevalidating;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={throttled(onPrev)}
        onMouseEnter={onHoverPrev}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="font-medium text-lg min-w-[180px] text-center inline-flex items-center justify-center gap-2">
        {getMonthName(month)} {year}
        {cold && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Carregando" />
        )}
        {hint && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse"
            aria-label="Atualizando"
          />
        )}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={throttled(onNext)}
        onMouseEnter={onHoverNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={throttled(onToday)}>
        Hoje
      </Button>
    </div>
  );
}
