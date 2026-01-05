import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OPCOES_MES } from './constants';
import type { FiltersProps } from './types';

type TipoPeriodo = 'ano-completo' | 'mes' | 'personalizado';

interface ExtendedFiltersProps extends FiltersProps {
  dataInicio?: string;
  dataFim?: string;
  onDataInicioChange?: (value: string) => void;
  onDataFimChange?: (value: string) => void;
}

export function DashboardFilters({
  anoSelecionado,
  setAnoSelecionado,
  mesSelecionado,
  setMesSelecionado,
  anosDisponiveis,
  getNomeMes,
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
}: ExtendedFiltersProps) {
  // Derive tipoPeriodo from mesSelecionado
  const getTipoPeriodo = (): TipoPeriodo => {
    if (mesSelecionado === 'personalizado') return 'personalizado';
    if (mesSelecionado === 'ano-completo') return 'ano-completo';
    return 'mes';
  };

  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>(getTipoPeriodo());

  const handleTipoPeriodoChange = (value: TipoPeriodo) => {
    setTipoPeriodo(value);
    if (value === 'ano-completo') {
      setMesSelecionado('ano-completo');
    } else if (value === 'personalizado') {
      setMesSelecionado('personalizado');
    } else if (value === 'mes') {
      // Set to current month if switching to month view
      const currentMonth = new Date().getMonth() + 1;
      setMesSelecionado(currentMonth.toString());
    }
  };

  const mesesSemAnoCompleto = OPCOES_MES.filter(m => m.value !== 'ano-completo');

  return (
    <section aria-label="Filtros" className="animate-fade-in">
      <Card className="p-3 rounded-xl border-0 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Ano */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
              <SelectTrigger className="w-24 h-9">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map(ano => (
                  <SelectItem key={ano} value={ano.toString()}>
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Período */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select value={tipoPeriodo} onValueChange={(v) => handleTipoPeriodoChange(v as TipoPeriodo)}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ano-completo">Ano Completo</SelectItem>
                <SelectItem value="mes">Mês Específico</SelectItem>
                <SelectItem value="personalizado">De - Até</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mês (condicional) */}
          {tipoPeriodo === 'mes' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mês</Label>
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mesesSemAnoCompleto.map(opcao => (
                    <SelectItem key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* De - Até (condicional) */}
          {tipoPeriodo === 'personalizado' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input 
                  type="date" 
                  value={dataInicio || ''} 
                  onChange={(e) => onDataInicioChange?.(e.target.value)} 
                  className="w-36 h-9" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input 
                  type="date" 
                  value={dataFim || ''} 
                  onChange={(e) => onDataFimChange?.(e.target.value)} 
                  className="w-36 h-9" 
                />
              </div>
            </>
          )}

          {/* Badge informativo */}
          {tipoPeriodo === 'mes' && mesSelecionado && mesSelecionado !== 'ano-completo' && mesSelecionado !== 'personalizado' && (
            <div className="flex items-end pb-0.5">
              <div className="px-2.5 py-1.5 bg-primary/10 rounded-md text-xs font-medium text-foreground border border-primary/20">
                {getNomeMes(mesSelecionado)} {anoSelecionado}
              </div>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}