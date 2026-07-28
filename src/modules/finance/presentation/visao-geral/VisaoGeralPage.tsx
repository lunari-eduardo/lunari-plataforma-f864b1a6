/**
 * VisaoGeralPage — nova página "Visão Geral" do módulo Financeiro.
 * Filosofia: luxo silencioso. Densidade baixa, 4 seções cognitivas.
 *   1. Estado Financeiro    — Saúde + KPIs cognitivos
 *   2. Acompanhamento       — Agenda + Pendências
 *   3. Análise Financeira   — Resultado mensal + Fluxo de caixa
 *   4. Custos e Resultado   — Mini DRE + Composição de despesas
 *
 * Reaproveita o hook useDashboardFinanceiro (sem novas queries).
 */
import { memo, useMemo } from 'react';
import { useDashboardFinanceiro } from '@/hooks/useDashboardFinanceiro';
import PeriodBar from './PeriodBar';
import EstadoFinanceiroSection from './EstadoFinanceiroSection';
import AcompanhamentoSection from './AcompanhamentoSection';
import AnaliseSection from './AnaliseSection';
import CustosSection from './CustosSection';

export const VisaoGeralPage = memo(function VisaoGeralPage() {
  const dash = useDashboardFinanceiro();

  const contasAPagar = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return dash.transacoesFiltradas
      .filter(t =>
        t.status !== 'Pago' &&
        t.status !== 'Cancelado' &&
        t.item &&
        ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(t.item.grupo_principal)
      )
      .reduce((s, t) => s + t.valor, 0);
  }, [dash.transacoesFiltradas]);

  return (
    <div className="space-y-8 pb-12">
      <PeriodBar
        ano={dash.anoSelecionado}
        setAno={dash.setAnoSelecionado}
        mes={dash.mesSelecionado}
        setMes={dash.setMesSelecionado}
        anosDisponiveis={dash.anosDisponiveis}
      />

      <EstadoFinanceiroSection
        kpis={dash.kpisData}
        metaReceita={dash.metasData.metaReceita}
        comparison={dash.comparisonData}
        dadosMensais={dash.dadosMensais}
        contasAPagar={contasAPagar}
      />

      <AcompanhamentoSection transacoes={dash.transacoesFiltradas as any} />

      <AnaliseSection dadosMensais={dash.dadosMensais} />

      <CustosSection
        receita={dash.kpisData.totalReceita}
        despesas={dash.kpisData.totalDespesas}
        lucro={dash.kpisData.totalLucro}
        composicao={dash.composicaoDespesas}
      />
    </div>
  );
});

export default VisaoGeralPage;
