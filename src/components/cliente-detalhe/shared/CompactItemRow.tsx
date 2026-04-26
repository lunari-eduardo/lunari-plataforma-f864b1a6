import { ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface CompactRowMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  separatorBefore?: boolean;
}

interface CompactItemRowProps {
  icon?: ReactNode;
  title: string;
  meta?: string;
  status?: ReactNode;
  primaryAction?: { label: string; icon: ReactNode; onClick: () => void };
  menuItems: CompactRowMenuItem[];
  onRowClick?: () => void;
}

/**
 * Linha compacta padronizada para listas dentro do detalhe do cliente
 * (briefings, contratos, etc.). Densidade alta, ações inline.
 */
export function CompactItemRow({
  icon,
  title,
  meta,
  status,
  primaryAction,
  menuItems,
  onRowClick,
}: CompactItemRowProps) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2 transition-colors',
        onRowClick && 'cursor-pointer hover:bg-accent/40'
      )}
      onClick={onRowClick}
    >
      {icon && (
        <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate leading-tight">{title}</p>
        {meta && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {meta}
          </p>
        )}
      </div>

      {primaryAction && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs hidden sm:inline-flex"
          onClick={(e) => {
            stop(e);
            primaryAction.onClick();
          }}
        >
          {primaryAction.icon}
          <span className="ml-1">{primaryAction.label}</span>
        </Button>
      )}

      {status && <div className="flex-shrink-0">{status}</div>}

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={stop}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 flex-shrink-0"
            aria-label="Mais ações"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" onClick={stop}>
          {menuItems.map((item, i) => (
            <div key={i}>
              {item.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                }}
                className={cn(
                  'gap-2 text-xs',
                  item.variant === 'destructive' &&
                    'text-destructive focus:text-destructive'
                )}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
