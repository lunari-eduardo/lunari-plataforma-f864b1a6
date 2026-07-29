import { useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface CollapsibleCustoSectionProps {
  icon: LucideIcon;
  title: string;
  total: number | string;
  /** Mantido por compatibilidade — a paleta agora é única (neutra + dourado). */
  colorClass?: 'amber' | 'blue' | 'emerald' | 'purple';
  children: React.ReactNode;
  defaultOpen?: boolean;
  suffix?: string;
}

export function CollapsibleCustoSection({
  icon: Icon,
  title,
  total,
  children,
  defaultOpen = false,
  suffix
}: CollapsibleCustoSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const formatCurrency = (value: number | string) => {
    if (typeof value === 'string') return value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-border/20 bg-card/60 overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--accent-gold))' }} />
              <span className="text-[13px] font-medium text-foreground truncate">{title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[15px] font-semibold text-foreground tabular-nums">
                {formatCurrency(total)}
              </span>
              {suffix && (
                <span className="text-[11px] text-muted-foreground">{suffix}</span>
              )}
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/20">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
