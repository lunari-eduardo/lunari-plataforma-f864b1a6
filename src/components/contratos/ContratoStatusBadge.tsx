import { useState } from 'react';
import type { ContratoStatus } from '@/types/contrato';
import { CONTRATO_STATUS_LABELS } from '@/types/contrato';
import { cn } from '@/lib/utils';
import { FileText, Send, CheckCircle2, XCircle } from 'lucide-react';

interface ContratoStatusBadgeProps {
  status: ContratoStatus;
  className?: string;
  showIcon?: boolean;
}

const config: Record<ContratoStatus, { bg: string; text: string; icon: any }> = {
  rascunho: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    icon: FileText,
  },
  enviado: {
    bg: 'bg-blue-100 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-400',
    icon: Send,
  },
  assinado: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  cancelado: {
    bg: 'bg-red-100 dark:bg-red-950/50',
    text: 'text-red-700 dark:text-red-400',
    icon: XCircle,
  },
};

export function ContratoStatusBadge({ status, className, showIcon = true }: ContratoStatusBadgeProps) {
  const c = config[status] || config.rascunho;
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium', c.bg, c.text, className)}>
      {showIcon && <Icon className="h-3 w-3" />}
      <span>{CONTRATO_STATUS_LABELS[status]}</span>
    </span>
  );
}
