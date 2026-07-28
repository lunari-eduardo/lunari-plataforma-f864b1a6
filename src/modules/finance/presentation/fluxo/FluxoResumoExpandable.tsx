import { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatCurrency } from '@/utils/financialUtils';
import { cn } from '@/lib/utils';

interface Row {
  label: string;
  value: number;
  ref: number; // referência (denominador) para preencher a barra
  tone?: 'neutral' | 'success' | 'destructive';
}

interface FluxoResumoExpandableProps {
  receita: number;
  despesas: number;
  lucro: number;
  resultadoAcumulado: number;
  saldoPrevisto: number;
}

const Bar = ({ row, max }: { row: Row; max: number }) => {
  const pct = max <= 0 ? 0 : Math.min(100, Math.abs(row.value) / max * 100);
  const toneClass =
    row.tone === 'success'
      ? 'bg-lunar-success/70'
      : row.tone === 'destructive'
        ? 'bg-destructive/70'
        : 'bg-foreground/60';
  return (
    <div className="flex items-center gap-4">
      <div className="w-40 text-sm text-muted-foreground shrink-0">{row.label}</div>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', toneClass)} style={{ width: `${pct}%` }} />
      </div>
      <div
        className={cn(
          'w-32 text-right text-sm font-medium tabular-nums shrink-0',
          row.value < 0 ? 'text-destructive' : 'text-foreground',
        )}
      >
        {formatCurrency(row.value)}
      </div>
    </div>
  );
};

const FluxoResumoExpandable = memo(function FluxoResumoExpandable({
  receita,
  despesas,
  lucro,
  resultadoAcumulado,
  saldoPrevisto,
}: FluxoResumoExpandableProps) {
  const [open, setOpen] = useState(false);
  const max = Math.max(
    Math.abs(receita),
    Math.abs(despesas),
    Math.abs(lucro),
    Math.abs(resultadoAcumulado),
    Math.abs(saldoPrevisto),
    1,
  );

  const rows: Row[] = [
    { label: 'Receita', value: receita, ref: max, tone: 'success' },
    { label: 'Despesas', value: despesas, ref: max, tone: 'destructive' },
    { label: 'Lucro', value: lucro, ref: max, tone: lucro >= 0 ? 'success' : 'destructive' },
    { label: 'Resultado acumulado', value: resultadoAcumulado, ref: max },
    { label: 'Saldo previsto', value: saldoPrevisto, ref: max },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full py-2 flex items-center justify-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors">
        <span>Resumo Financeiro</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="py-6 px-2 space-y-3">
          {rows.map((r) => (
            <Bar key={r.label} row={r} max={max} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

export default FluxoResumoExpandable;
