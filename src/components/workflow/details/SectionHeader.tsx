import React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Header padrão dos blocos do card expandido do Workflow.
 * Ícone em badge quadrado estilizado + título em caixa alta + subtítulo descritivo.
 * Slot `action` opcional à direita (usado, por ex., pelo bloco Produtos para o botão "Gerenciar").
 */
export function SectionHeader({ icon: Icon, title, subtitle, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 pb-3 mb-4 border-b border-border/15",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-[#231E19] dark:bg-stone-900 border border-stone-800/60 flex items-center justify-center text-[#E0C6A5] dark:text-amber-300 shrink-0 shadow-2xs">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex flex-col">
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {title}
          </h4>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action ? <div className="flex items-center shrink-0">{action}</div> : null}
    </div>
  );
}
