/**
 * PeriodBar — barra da página Visão Geral.
 * Filtros de período. Sem botões de ação (esses vivem no FinanceHeader global).
 */
import { memo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OPCOES_MES } from '@/components/financas/dashboard/constants';

type Competencia = 'mes' | 'ano' | 'todo';

interface PeriodBarProps {
  ano: string;
  setAno: (v: string) => void;
  mes: string;
  setMes: (v: string) => void;
  anosDisponiveis: number[];
}

function resolveCompetencia(mes: string): Competencia {
  if (mes === 'ano-completo') return 'ano';
  if (mes === 'personalizado') return 'todo';
  return 'mes';
}

export const PeriodBar = memo(function PeriodBar({
  ano, setAno, mes, setMes, anosDisponiveis,
}: PeriodBarProps) {
  const competencia = resolveCompetencia(mes);
  const mesesSemAno = OPCOES_MES.filter(m => m.value !== 'ano-completo');

  const handleCompetencia = (c: Competencia) => {
    if (c === 'ano') setMes('ano-completo');
    else if (c === 'todo') setMes('personalizado');
    else setMes(String(new Date().getMonth() + 1));
  };

  const seg = (active: boolean) =>
    `px-3 h-8 text-xs font-medium rounded-md transition-colors ${
      active
        ? 'bg-foreground text-background'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
    }`;

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Período</span>
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-24 h-9 border-border/60 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {anosDisponiveis.map(a => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {competencia === 'mes' && (
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-36 h-9 border-border/60 bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mesesSemAno.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-border/60 bg-muted/30">
        <button type="button" className={seg(competencia === 'mes')} onClick={() => handleCompetencia('mes')}>Mês</button>
        <button type="button" className={seg(competencia === 'ano')} onClick={() => handleCompetencia('ano')}>Ano</button>
        <button type="button" className={seg(competencia === 'todo')} onClick={() => handleCompetencia('todo')}>Todo o período</button>
      </div>
    </div>
  );
});

export default PeriodBar;
