import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OPCOES_MES } from './constants';
import type { FiltersProps } from './types';

export function DashboardFilters({
  anoSelecionado,
  setAnoSelecionado,
  mesSelecionado,
  setMesSelecionado,
  anosDisponiveis,
  getNomeMes
}: FiltersProps) {
  return (
    <section aria-label="Filtros" className="animate-fade-in">
      <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Filtros de período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-xs text-lunar-textSecondary font-medium block mb-2">
                Ano
              </label>
              <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o ano" />
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

            <div className="flex-1">
              <label className="text-xs text-lunar-textSecondary font-medium block mb-2">
                Período
              </label>
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_MES.map(opcao => (
                    <SelectItem key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mesSelecionado && mesSelecionado !== 'ano-completo' && (
              <div className="flex items-end">
                <div className="px-3 py-2 bg-brand-gradient/10 rounded-lg text-sm font-medium text-lunar-text border border-lunar-border/30">
                  {getNomeMes(mesSelecionado)} {anoSelecionado}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}