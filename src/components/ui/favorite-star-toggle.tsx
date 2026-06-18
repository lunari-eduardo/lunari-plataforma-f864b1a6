import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FavoriteStarToggleProps {
  favorito: boolean;
  onToggle: () => void;
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function FavoriteStarToggle({
  favorito,
  onToggle,
  className,
  size = 'md',
  disabled = false,
}: FavoriteStarToggleProps) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-pressed={favorito}
            aria-label={favorito ? 'Desfavoritar produto' : 'Favoritar produto'}
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={cn(
              'inline-flex items-center justify-center rounded-md transition-colors',
              'hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              btnSize,
              className
            )}
          >
            <Star
              className={cn(
                iconSize,
                'transition-colors',
                favorito ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground hover:text-amber-500'
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {favorito ? 'Desfavoritar' : 'Favoritar'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
