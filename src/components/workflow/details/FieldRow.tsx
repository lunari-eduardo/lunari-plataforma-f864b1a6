import React from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: React.ReactNode;
  children: React.ReactNode;
  align?: "row" | "col";
  className?: string;
}

/**
 * Linha de campo padrão dos blocos do card expandido.
 * Rótulo à esquerda, conteúdo à direita, hairline sutil abaixo.
 * Variante `col` empilha (usada por Observações).
 */
export function FieldRow({ label, children, align = "row", className }: Props) {
  if (align === "col") {
    return (
      <div className={cn("flex flex-col gap-1.5 py-1.5", className)}>
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <div className="min-w-0">{children}</div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-1.5 border-b border-border/10 last:border-0",
        className,
      )}
    >
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="min-w-0 flex items-center gap-2 justify-end">{children}</div>
    </div>
  );
}
