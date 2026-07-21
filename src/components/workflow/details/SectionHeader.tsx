import React from "react";
import { cn } from "@/lib/utils";
import { BLOCK_ICON_CLS, SECTION_TITLE_CLS } from "./cardTokens";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Header padrão dos blocos do card expandido do Workflow.
 * Ícone + título em caixa alta + hairline inferior. Slot `action` opcional
 * à direita (usado, por ex., pelo bloco Produtos para "Gerenciar").
 */
export function SectionHeader({ icon: Icon, title, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-border/20",
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={BLOCK_ICON_CLS} />
        <h4 className={SECTION_TITLE_CLS}>{title}</h4>
      </div>
      {action ? <div className="flex items-center">{action}</div> : null}
    </div>
  );
}
