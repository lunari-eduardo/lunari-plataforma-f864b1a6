import { useState } from 'react';
import { AdminGlobalFilters } from './AdminGlobalFilters';
import { AdminKpiCards } from './AdminKpiCards';
import { AdminCityRanking } from './AdminCityRanking';
import { AdminNicheRanking } from './AdminNicheRanking';
import { AdminCityNicheCross } from './AdminCityNicheCross';
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics';
import type { AdminFilters } from '@/types/admin-analytics';
import { Loader2 } from 'lucide-react';

export function AdminStrategyTab() {
  const [filters, setFilters] = useState<AdminFilters>({
    periodo: 'todos',
    tipoUsuario: 'todos'
  });

  const {
    isLoading,
    kpis,
    faturamentoCidade,
    faturamentoNicho,
    faturamentoCidadeNicho,
    cidadesDisponiveis,
    nichosDisponiveis
  } = useAdminAnalytics(filters);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros Globais */}
      <AdminGlobalFilters
        filters={filters}
        onFiltersChange={setFilters}
        cidadesDisponiveis={cidadesDisponiveis}
        nichosDisponiveis={nichosDisponiveis}
      />

      {/* Cards de KPIs */}
      <AdminKpiCards kpis={kpis} />

      {/* Rankings em grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ranking de Cidades */}
        <AdminCityRanking data={faturamentoCidade} />

        {/* Ranking de Nichos */}
        <AdminNicheRanking data={faturamentoNicho} />
      </div>

      {/* Cruzamento Cidade x Nicho */}
      <AdminCityNicheCross data={faturamentoCidadeNicho} />
    </div>
  );
}
