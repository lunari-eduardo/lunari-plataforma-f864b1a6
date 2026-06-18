import React from 'react';
import { cn } from '@/lib/utils';
import { getEtiquetaTokens } from '@/utils/etiquetaColorTokens';
import { X } from 'lucide-react';
import type { ProdutoEtiqueta } from '@/types/configuration';

interface EtiquetaChipProps {
  etiqueta: Pick<ProdutoEtiqueta, 'nome' | 'cor'>;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  showDot?: boolean;
  size?: 'xs' | 'sm';
  count?: number;
  className?: string;
}

export function EtiquetaChip({
  etiqueta,
  active = false,
  onClick,
  onRemove,
  showDot = true,
  size = 'sm',
  count,
  className,
}: EtiquetaChipProps) {
  const tokens = getEtiquetaTokens(etiqueta.cor);
  const sizeCls = size === 'xs'
    ? 'h-5 px-1.5 text-[10px] gap-1'
    : 'h-6 px-2 text-xs gap-1.5';

  const Comp: any = onClick ? 'button' : 'span';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        'transition-colors select-none',
        active ? tokens.chipActive : tokens.chip,
        onClick && 'cursor-pointer hover:brightness-110',
        sizeCls,
        className
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', tokens.dot)} aria-hidden />}
      <span className="truncate max-w-[140px]">{etiqueta.nome}</span>
      {typeof count === 'number' && (
        <span className="opacity-70 tabular-nums">({count})</span>
      )}
      {onRemove && (
        <span
          role="button"
          aria-label="Remover etiqueta"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="inline-flex items-center justify-center rounded-full hover:bg-foreground/10 -mr-0.5 ml-0.5 h-3.5 w-3.5"
        >
          <X className="h-2.5 w-2.5" />
        </span>
      )}
    </Comp>
  );
}
