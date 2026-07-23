import { useEffect, useRef, useState } from "react";
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
  /**
   * Callback unificado que recebe o delta acumulado após o debounce.
   * -N/+N = pular meses; 'today' = ir para hoje.
   * Preferido em relação a onPrev/onNext (que ainda existem para compat).
   */
  onNavigate?: (delta: number | "today") => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  onHoverPrev?: () => void;
  onHoverNext?: () => void;
}

const SETTLE_MS = 180;

/**
 * Seletor de mês com **coalescing**: cliques rápidos em setas atualizam
 * o rótulo instantaneamente, mas o `onNavigate` só dispara com o delta
 * final após `SETTLE_MS` de calmaria. Evita cascatas de fetch.
 *
 * Feedback visual:
 * - Cold load: Loader2 girando.
 * - Revalidando: dot pulsante 6px, cor muted — não bloqueia leitura.
 */
export function WorkflowMonthSwitcher({
  month, year, isPreloading, isColdLoading = false, isRevalidating = false,
  onNavigate, onPrev, onNext, onToday, onHoverPrev, onHoverNext,
}: Props) {
  const pendingDeltaRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingLabel, setPendingLabel] = useState<{ month: number; year: number } | null>(null);

  useEffect(() => {
    // Ao chegar novo mês do pai, limpa o preview local.
    setPendingLabel(null);
  }, [month, year]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const scheduleSettle = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const delta = pendingDeltaRef.current;
      pendingDeltaRef.current = 0;
      timerRef.current = null;
      if (delta === 0) return;
      if (onNavigate) {
        onNavigate(delta);
      } else {
        // Fallback para API antiga: aplica delta 1 a 1.
        const step = delta > 0 ? onNext : onPrev;
        const count = Math.abs(delta);
        for (let i = 0; i < count; i++) step?.();
      }
    }, SETTLE_MS);
  };

  const previewFor = (delta: number) => {
    const base = pendingLabel ?? { month, year };
    let m = base.month + delta;
    let y = base.year;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    return { month: m, year: y };
  };

  const handleClick = (delta: 1 | -1) => {
    pendingDeltaRef.current += delta;
    setPendingLabel(previewFor(delta));
    scheduleSettle();
  };

  const handleToday = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pendingDeltaRef.current = 0;
    setPendingLabel(null);
    if (onNavigate) onNavigate("today");
    else onToday?.();
  };

  const displayed = pendingLabel ?? { month, year };
  const cold = isColdLoading || isPreloading;
  const hint = !cold && (isRevalidating || pendingLabel !== null);

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleClick(-1)}
        onMouseEnter={onHoverPrev}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="font-medium text-lg min-w-[180px] text-center inline-flex items-center justify-center gap-2">
        {getMonthName(displayed.month)} {displayed.year}
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
        onClick={() => handleClick(1)}
        onMouseEnter={onHoverNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={handleToday}>
        Hoje
      </Button>
    </div>
  );
}
