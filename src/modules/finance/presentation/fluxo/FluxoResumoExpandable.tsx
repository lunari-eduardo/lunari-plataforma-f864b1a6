import { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useExtrato } from '@/hooks/useExtrato';
import DemonstrativoSimplificado from '@/components/financas/DemonstrativoSimplificado';

interface FluxoResumoExpandableProps {
  receita: number;
  despesas: number;
  lucro: number;
  resultadoAcumulado: number;
  saldoPrevisto: number;
}

const FluxoResumoExpandable = memo(function FluxoResumoExpandable(_props: FluxoResumoExpandableProps) {
  const [open, setOpen] = useState(false);
  const extrato = useExtrato();

  const demonstrativo = extrato.demonstrativo;
  const inicio = extrato.filtros?.dataInicio || '';
  const fim = extrato.filtros?.dataFim || '';
  const transactions = (extrato as any).transacoesRaw || [];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full py-2 flex items-center justify-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors">
        <span>Resumo Financeiro</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="py-6 px-2">
          {demonstrativo ? (
            <DemonstrativoSimplificado
              demonstrativo={demonstrativo}
              periodo={{ inicio, fim }}
              transactions={transactions}
            />
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              Sem dados suficientes para o demonstrativo neste período.
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

export default FluxoResumoExpandable;
