import React from "react";
import { ArrowRight } from "lucide-react";

export interface ChargeStep {
  current: number;
  total: number;
  label: string;
  nextLabel?: string;
}

interface Props {
  step?: ChargeStep | null;
}

/**
 * Badge de stepper exibido no header dos modais de cobrança quando o usuário
 * está no fluxo "Cobrar tudo" (2 links sequenciais: sessão → extras via Gallery).
 * Deixa explícito que uma segunda cobrança virá depois.
 */
export function ChargeStepBadge({ step }: Props) {
  if (!step) return null;
  return (
    <div className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
      <span className="tabular-nums">
        Passo {step.current}/{step.total}
      </span>
      <span className="opacity-70">·</span>
      <span>{step.label}</span>
      {step.nextLabel && (
        <span className="flex items-center gap-1 text-muted-foreground font-normal">
          <ArrowRight className="h-3 w-3" />
          {step.nextLabel}
        </span>
      )}
    </div>
  );
}
