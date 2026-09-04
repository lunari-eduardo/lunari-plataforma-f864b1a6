/**
 * PeriodActionBar — barra unificada entre "Visão Geral" e "Fluxo Financeiro".
 * Layout: [Ano ▾] [Mês ▾]                              [+ Novo lançamento ▾]
 *
 * Sem card, sem borda, uma linha só. Silent Luxury.
 */
import { memo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NovoLancamentoMenu from './NovoLancamentoMenu';
import { OPCOES_MES } from '@/components/financas/dashboard/constants';
import type { LancamentoTipo } from '@/modules/finance/domain/lancamentoTipos';

interface PeriodActionBarProps {
  ano: string;
  setAno: (v: string) => void;
  mes: string;
  setMes: (v: string) => void;
  anosDisponiveis: number[];
  /** Mostra a opção "Ano todo" no seletor de mês. */
  showAnoTodo?: boolean;
  onSelectTipo: (tipo: LancamentoTipo) => void;
  extraLeft?: React.ReactNode;
}

export const PeriodActionBar = memo(function PeriodActionBar({
  ano,
  setAno,
  mes,
  setMes,
  anosDisponiveis,
  showAnoTodo = false,
  onSelectTipo,
  extraLeft,
}: PeriodActionBarProps) {
  const mesesSemAnoTodo = OPCOES_MES.filter((m) => m.value !== 'ano-completo');
  const meses = showAnoTodo ? OPCOES_MES : mesesSemAnoTodo;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-[86px] sm:w-24 h-9 border-border/60 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {anosDisponiveis.map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[128px] sm:w-36 h-9 border-border/60 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meses.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {extraLeft}
      </div>

      <div className="shrink-0 ml-auto">
        <NovoLancamentoMenu onSelectTipo={onSelectTipo} />
      </div>
    </div>
  );
});

export default PeriodActionBar;
