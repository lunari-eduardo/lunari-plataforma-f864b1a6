import { memo } from 'react';
import { formatCurrency } from '@/utils/financialUtils';
import { cn } from '@/lib/utils';

interface FluxoResumoBarProps {
  entradas: number;
  saidas: number;
  saldo: number;
  selecionados: number;
}

const Item = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold tabular-nums">{children}</span>
  </div>
);

const FluxoResumoBar = memo(function FluxoResumoBar({
  entradas,
  saidas,
  saldo,
  selecionados,
}: FluxoResumoBarProps) {
  return (
    <div className="grid grid-cols-2 sm:flex sm:items-center sm:gap-12 gap-4 border-y border-border py-3 px-1">
      <Item label="Entradas">
        <span className="text-lunar-success">{formatCurrency(entradas)}</span>
      </Item>
      <Item label="Saídas">
        <span className="text-destructive">{formatCurrency(saidas)}</span>
      </Item>
      <Item label="Saldo">
        <span className={cn(saldo >= 0 ? 'text-foreground' : 'text-destructive')}>{formatCurrency(saldo)}</span>
      </Item>
      <Item label="Selecionados">
        <span className="text-foreground">{selecionados}</span>
      </Item>
    </div>
  );
});

export default FluxoResumoBar;
