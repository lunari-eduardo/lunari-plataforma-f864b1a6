import { memo, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useDemonstrativoFinanceiro } from '@/hooks/useDemonstrativoFinanceiro';
import { useRegimeContabil } from '@/hooks/useRegimeContabil';
import DemonstrativoSimplificado from '@/components/financas/DemonstrativoSimplificado';

interface FluxoResumoExpandableProps {
  /** Período atualmente selecionado no Fluxo (mês/ano) */
  ano: number;
  mes: number;
}

type Escopo = 'mes' | 'ano';

const FluxoResumoExpandable = memo(function FluxoResumoExpandable({ ano, mes }: FluxoResumoExpandableProps) {
  const [open, setOpen] = useState(false);
  const [escopo, setEscopo] = useState<Escopo>('mes');
  const { regime } = useRegimeContabil();

  // O demonstrativo acompanha o período do Fluxo (ou o ano inteiro, se escolhido)
  const { inicio, fim } = useMemo(() => {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (escopo === 'ano') {
      return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
    }
    return { inicio: fmt(new Date(ano, mes - 1, 1)), fim: fmt(new Date(ano, mes, 0)) };
  }, [ano, mes, escopo]);

  const { demonstrativo, isLoading } = useDemonstrativoFinanceiro(inicio, fim, regime, open);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full py-2 flex items-center justify-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors">
        <span>Resumo Financeiro</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="py-6 px-2">
          <div className="flex items-center justify-center gap-1 pb-4">
            {(['mes', 'ano'] as Escopo[]).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setEscopo(op)}
                className={cn(
                  'h-7 px-3 rounded-full text-xs font-medium transition-colors',
                  escopo === op
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {op === 'mes' ? 'Mês selecionado' : `Ano ${ano}`}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Calculando demonstrativo…</div>
          ) : (
            <DemonstrativoSimplificado
              demonstrativo={demonstrativo}
              periodo={{ inicio, fim }}
              transactions={[]}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

export default FluxoResumoExpandable;
