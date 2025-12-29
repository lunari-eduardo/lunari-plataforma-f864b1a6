import { useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface CollapsibleCustoSectionProps {
  icon: LucideIcon;
  title: string;
  total: number | string;
  colorClass: 'amber' | 'blue' | 'emerald' | 'purple';
  children: React.ReactNode;
  defaultOpen?: boolean;
  suffix?: string;
}

const colorMap = {
  amber: {
    bg: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-500/30',
    icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-amber-800 dark:text-amber-300'
  },
  blue: {
    bg: 'from-blue-500/20 to-blue-500/5',
    border: 'border-blue-500/30',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-800 dark:text-blue-300'
  },
  emerald: {
    bg: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    title: 'text-emerald-800 dark:text-emerald-300'
  },
  purple: {
    bg: 'from-purple-500/20 to-purple-500/5',
    border: 'border-purple-500/30',
    icon: 'text-purple-600 dark:text-purple-400',
    title: 'text-purple-800 dark:text-purple-300'
  }
};

export function CollapsibleCustoSection({
  icon: Icon,
  title,
  total,
  colorClass,
  children,
  defaultOpen = false,
  suffix
}: CollapsibleCustoSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors = colorMap[colorClass];

  const formatCurrency = (value: number | string) => {
    if (typeof value === 'string') return value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className={cn(
            "flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors",
            `bg-gradient-to-r ${colors.bg} border-b ${colors.border}`
          )}>
            <div className="flex items-center gap-3">
              <Icon className={cn("h-5 w-5", colors.icon)} />
              <span className={cn("font-semibold", colors.title)}>{title}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="font-bold text-lg text-foreground">
                  {formatCurrency(total)}
                </span>
                {suffix && (
                  <span className="text-xs text-muted-foreground ml-1">{suffix}</span>
                )}
              </div>
              <ChevronDown className={cn(
                "h-5 w-5 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 space-y-4">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
