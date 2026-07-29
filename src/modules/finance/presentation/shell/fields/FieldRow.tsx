/**
 * FieldRow — linha de campo compacta, estilo Silent Luxury.
 * Label discreto à esquerda, controle à direita, divisor sutil.
 * Usado para todos os selects/datas/observações do drawer.
 */
import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldRowProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  align?: 'center' | 'start';
  className?: string;
}

export const FieldRow = memo(function FieldRow({
  label,
  hint,
  required,
  children,
  align = 'center',
  className,
}: FieldRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-2.5 border-b border-border/30 last:border-b-0',
        align === 'start' ? 'items-start' : 'items-center',
        className,
      )}
    >
      <div className="pt-0.5">
        <label className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-accent-gold">*</span>}
        </label>
        {hint && (
          <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground/70">{hint}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
});

export default FieldRow;
