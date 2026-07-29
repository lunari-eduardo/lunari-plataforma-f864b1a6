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
  /** Mostra a opção "Ano todo" no seletor de mês (apenas Visão Geral). */
  showAnoTodo?: boolean;
  onSelectTipo: (tipo: LancamentoTipo) => void;
}

export const PeriodActionBar = memo(function PeriodActionBar({
  ano,
  setAno,
  mes,
  setMes,
  anosDisponiveis,
  showAnoTodo = false,
  onSelectTipo,
}: PeriodActionBarProps) {
  const mesesSemAnoTodo = OPCOES_MES.filter((m) => m.value !== 'ano-completo');
  const meses = showAnoTodo ? OPCOES_MES : mesesSemAnoTodo;

  return (
    <div className="flex items-center justify-between gap-3 pb-4">
      <div className="flex items-center gap-2">
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-24 h-9 border-border/60 bg-transparent">
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
          <SelectTrigger className="w-36 h-9 border-border/60 bg-transparent">
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
      </div>

      <NovoLancamentoMenu onSelectTipo={onSelectTipo} />
    </div>
  );
});

export default PeriodActionBar;
