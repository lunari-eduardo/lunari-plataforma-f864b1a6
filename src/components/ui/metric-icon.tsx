import type { ComponentType, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface MetricIconBadgeProps {
  Icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  /** sm = 28px fixo · md = 28px mobile / 36px desktop (padrão Visão Geral) */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Badge padrão de ícone de card de métrica — "Silent Luxury".
 * Quadrado arredondado, fundo dourado suave, ícone dourado fosco.
 * Fonte de verdade: Finanças › Visão Geral › MetricCard.
 */
export function MetricIconBadge({ Icon, size = "md", className }: MetricIconBadgeProps) {
  const box = size === "sm" ? "h-7 w-7" : "h-7 w-7 sm:h-9 sm:w-9";
  const icon = size === "sm" ? "h-[14px] w-[14px]" : "h-[14px] w-[14px] sm:h-[18px] sm:w-[18px]";

  return (
    <div
      className={cn("shrink-0 rounded-lg flex items-center justify-center", box, className)}
      style={{ background: "hsl(var(--accent-gold-soft))" }}
    >
      <Icon className={icon} style={{ color: "hsl(var(--accent-gold))" }} />
    </div>
  );
}

export default MetricIconBadge;
