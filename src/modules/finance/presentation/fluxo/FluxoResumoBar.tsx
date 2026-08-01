import { memo } from 'react';
import { formatCurrency } from '@/utils/financialUtils';
import { cn } from '@/lib/utils';

interface FluxoResumoBarProps {
  entradas: number;
  saidas: number;
  saldo: number;
  selecionados: number;
  selecaoEntradas?: number;
  selecaoSaidas?: number;
  selecaoSaldo?: number;
  onClearSelection?: () => void;
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
  selecaoEntradas = 0,
  selecaoSaidas = 0,
  selecaoSaldo = 0,
  onClearSelection,
}: FluxoResumoBarProps) {
  const emSelecao = selecionados > 0;
  const vEntradas = emSelecao ? selecaoEntradas : entradas;
  const vSaidas = emSelecao ? selecaoSaidas : saidas;
  const vSaldo = emSelecao ? selecaoSaldo : saldo;

  return (
    <div className="grid grid-cols-2 sm:flex sm:items-center sm:gap-12 gap-4 border-y border-border py-3 px-1">
      <Item label={emSelecao ? 'Entradas (seleção)' : 'Entradas'}>
        <span className="text-lunar-success">{formatCurrency(vEntradas)}</span>
      </Item>
      <Item label={emSelecao ? 'Saídas (seleção)' : 'Saídas'}>
        <span className="text-destructive">{formatCurrency(vSaidas)}</span>
      </Item>
      <Item label={emSelecao ? 'Saldo (seleção)' : 'Saldo'}>
        <span className={cn(vSaldo >= 0 ? 'text-foreground' : 'text-destructive')}>{formatCurrency(vSaldo)}</span>
      </Item>
      <Item label="Selecionados">
        <span className="flex items-center gap-2 text-foreground">
          {selecionados}
          {emSelecao && onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar
            </button>
          )}
        </span>
      </Item>
    </div>
  );
});

export default FluxoResumoBar;
