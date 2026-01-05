/**
 * Status Badge Component
 * Standardized status display for financial transactions
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, FileText } from "lucide-react";

export type StatusType = "Pago" | "Faturado" | "Agendado" | "pago" | "faturado" | "agendado";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<string, { 
  bg: string; 
  text: string; 
  icon: React.ElementType;
  label: string;
}> = {
  pago: {
    bg: "bg-emerald-100 dark:bg-emerald-950/50",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
    label: "Pago",
  },
  faturado: {
    bg: "bg-red-100 dark:bg-red-950/50",
    text: "text-red-700 dark:text-red-400",
    icon: FileText,
    label: "Faturado",
  },
  agendado: {
    bg: "bg-amber-100 dark:bg-amber-950/50",
    text: "text-amber-700 dark:text-amber-400",
    icon: Clock,
    label: "Agendado",
  },
};

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as keyof typeof statusConfig;
  const config = statusConfig[normalizedStatus] || statusConfig.agendado;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      <span>{config.label}</span>
    </span>
  );
}
