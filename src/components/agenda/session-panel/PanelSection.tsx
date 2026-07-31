/**
 * Primitivas visuais do Painel de Sessão.
 * Todas as seções do Drawer usam exatamente o mesmo padrão de
 * espaçamento, altura, padding, raio e tipografia.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface PanelSectionProps {
  icon?: LucideIcon;
  title: string;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function PanelSection({ icon: Icon, title, action, className, children }: PanelSectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border/60 bg-card/60 p-3.5 space-y-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 min-h-[28px]">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          {Icon && <Icon className="h-4 w-4 text-accent-gold" />}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

interface PanelFieldProps {
  label?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function PanelField({ label, htmlFor, className, children }: PanelFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs text-muted-foreground">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
