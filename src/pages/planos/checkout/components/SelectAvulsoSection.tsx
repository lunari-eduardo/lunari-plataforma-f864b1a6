import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditPackage } from '@/hooks/useCreditPackages';
import { cn } from '@/lib/utils';
import { BENEFITS_AVULSO } from '../types';

interface SelectAvulsoSectionProps {
  isLoadingPackages: boolean;
  avulsos: CreditPackage[];
  formatPrice: (cents: number) => string;
  onBuy: (pkg: CreditPackage) => void;
}

export function SelectAvulsoSection({
  isLoadingPackages,
  avulsos,
  formatPrice,
  onBuy,
}: SelectAvulsoSectionProps) {
  const isHighlighted = (pkg: CreditPackage) => pkg.sort_order === 3;

  return (
    <section className="container max-w-6xl -mt-12 md:-mt-16 relative z-[1] pb-20">
      {isLoadingPackages ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {avulsos.map((pkg) => {
            const highlighted = isHighlighted(pkg);
            return (
              <div
                key={pkg.id}
                className={cn(
                  'relative flex flex-col rounded-2xl border bg-card p-8 transition-all hover:shadow-md',
                  highlighted
                    ? 'border-primary shadow-md ring-1 ring-primary/20'
                    : 'border-border shadow-sm'
                )}
              >
                {highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs gap-1">
                    <Star className="h-3 w-3" />
                    Mais escolhido
                  </Badge>
                )}
                <p className="text-lg font-semibold text-foreground">{pkg.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {pkg.credits.toLocaleString('pt-BR')} créditos
                </p>
                <p className="text-3xl font-bold text-primary mt-5">
                  {formatPrice(pkg.price_cents)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">pagamento único</p>
                <Button className="mt-6 px-8" size="lg" onClick={() => onBuy(pkg)}>
                  Comprar
                </Button>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {BENEFITS_AVULSO.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <Icon className="h-4 w-4 text-primary/70 shrink-0" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
