import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BillingToggleProps {
  billingPeriod: 'monthly' | 'yearly';
  onChange: (v: 'monthly' | 'yearly') => void;
  discount?: string;
}

export function BillingToggle({
  billingPeriod,
  onChange,
  discount = '-16%',
}: BillingToggleProps) {
  return (
    <div className="inline-flex items-center rounded-full border bg-muted/50 p-1 gap-0.5">
      <button
        onClick={() => onChange('monthly')}
        className={cn(
          'rounded-full px-5 py-2 text-sm font-medium transition-all',
          billingPeriod === 'monthly'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Mensal
      </button>
      <button
        onClick={() => onChange('yearly')}
        className={cn(
          'rounded-full px-5 py-2 text-sm font-medium transition-all flex items-center gap-2',
          billingPeriod === 'yearly'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Anual
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {discount}
        </Badge>
      </button>
    </div>
  );
}
