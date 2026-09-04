import { memo, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { calcularDemonstrativoDeLinhas, useDemonstrativoFinanceiro } from '@/hooks/useDemonstrativoFinanceiro';
import type { RegimeContabil } from '@/hooks/useExtratoSupabase';
import type { LinhaExtrato } from '@/types/extrato';
import DemonstrativoSimplificado from '@/components/financas/DemonstrativoSimplificado';

interface FluxoResumoExpandableProps {
  ano: number;
  mes: string; // 'ano-completo' | '1'..'12'
  periodo: { inicio: string; fim: string };
  linhas: LinhaExtrato[];
  regime: RegimeContabil;
  onSetMes?: (mes: string) => void;
}

type Escopo = 'mes' | 'ano';

const FluxoResumoExpandable = memo(function FluxoResumoExpandable({
  ano,
  mes,
  periodo,
  linhas,
  regime,
  onSetMes,
}: FluxoResumoExpandableProps) {
  const [open, setOpen] = useState(false);
  const isAnoTodo = mes === 'ano-completo';
  const [escopo, setEscopo] = useState<Escopo>(isAnoTodo ? 'ano' : 'mes');

  // Mantém escopo sincronizado se mes mudar externamente
  const escopoEfetivo = isAnoTodo ? 'ano' : escopo;

  // Demonstrativo do período corrente do fluxo (calculado em memória sobre os dados filtrados)
  const demonstrativoLocal = useMemo(() => {
    return calcularDemonstrativoDeLinhas(linhas, regime);
  }, [linhas, regime]);

  // Se o usuário estiver vendo um mês específico, mas clicar em "Ano 2026" dentro do collapsible:
  // Consulta o consolidado anual
  const precisaQueryAnual = !isAnoTodo && escopoEfetivo === 'ano';
  const { demonstrativo: demonstrativoAnoQuery, isLoading: isLoadingAno } = useDemonstrativoFinanceiro(
    `${ano}-01-01`,
    `${ano}-12-31`,
    regime,
    open && precisaQueryAnual
  );

  const demonstrativo = precisaQueryAnual ? demonstrativoAnoQuery : demonstrativoLocal;
  const isLoading = precisaQueryAnual ? isLoadingAno : false;

  const periodoExibido = useMemo(() => {
    if (escopoEfetivo === 'ano') {
      return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
    }
    return periodo;
  }, [escopoEfetivo, ano, periodo]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full py-2 flex items-center justify-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors">
        <span>Resumo Financeiro (Demonstrativo)</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="py-6 px-2">
          {!isAnoTodo && (
            <div className="flex items-center justify-center gap-1 pb-4">
              {(['mes', 'ano'] as Escopo[]).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setEscopo(op)}
                  className={cn(
                    'h-7 px-3 rounded-full text-xs font-medium transition-colors',
                    escopoEfetivo === op
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  {op === 'mes' ? 'Mês selecionado' : `Ano ${ano}`}
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Calculando demonstrativo…</div>
          ) : (
            <DemonstrativoSimplificado
              demonstrativo={demonstrativo}
              periodo={periodoExibido}
              transactions={linhas}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

export default FluxoResumoExpandable;
