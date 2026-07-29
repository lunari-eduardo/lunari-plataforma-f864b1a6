/**
 * Faixa de resumo da Precificação — Onda 5 "Silent Luxury".
 * Deixou de ser sidebar vertical: agora é uma faixa horizontal sticky no topo,
 * sempre visível enquanto o usuário navega entre as etapas.
 */
import { Wallet, Clock, Target, DollarSign, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricIconBadge } from '@/components/ui/metric-icon';

interface ResumoFinanceiroStickyProps {
  custoFixoMensal: number;
  custoHora: number;
  metaFaturamentoMensal: number;
  precoFinalServico?: number;
  isCalculating?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value || 0);

interface Item {
  label: string;
  value: number;
  icon: LucideIcon;
  highlight?: boolean;
}

function Metric({ label, value, icon, highlight, pulse }: Item & { pulse?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', pulse && 'animate-pulse')}>
      <MetricIconBadge Icon={icon} size="sm" />
      <div className="min-w-0">
        <p className="text-[11px] leading-none text-muted-foreground truncate">{label}</p>
        <p
          className={cn(
            'mt-1 text-[17px] font-semibold leading-none tabular-nums truncate',
            highlight ? 'text-[hsl(var(--accent-gold))]' : 'text-foreground',
          )}
        >
          {formatCurrency(value)}
        </p>
      </div>
    </div>
  );
}

export function ResumoFinanceiroSticky({
  custoFixoMensal,
  custoHora,
  metaFaturamentoMensal,
  precoFinalServico,
  isCalculating = false,
}: ResumoFinanceiroStickyProps) {
  const showPreco = precoFinalServico !== undefined && precoFinalServico > 0;

  const itens: Item[] = [
    { label: 'Custo fixo mensal', value: custoFixoMensal, icon: Wallet },
    { label: 'Custo da hora', value: custoHora, icon: Clock },
    { label: 'Meta mensal', value: metaFaturamentoMensal, icon: Target },
  ];

  if (showPreco) {
    itens.push({
      label: 'Preço final',
      value: precoFinalServico as number,
      icon: DollarSign,
      highlight: true,
    });
  }

  return (
    <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/85 backdrop-blur-sm border-b border-border/20">
      <div
        className={cn(
          'grid gap-x-4 gap-y-3',
          showPreco ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3',
        )}
      >
        {itens.map((item) => (
          <Metric key={item.label} {...item} pulse={isCalculating} />
        ))}
      </div>
    </div>
  );
}

export default ResumoFinanceiroSticky;
