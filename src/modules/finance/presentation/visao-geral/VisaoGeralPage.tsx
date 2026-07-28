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

  const RECEITA_GROUPS = ['Receita Não Operacional', 'Receita Operacional'];
  const DESPESA_GROUPS = ['Despesa Fixa', 'Despesa Variável', 'Investimento'];

  const { contasAPagar, qtdAReceber, qtdAPagar } = useMemo(() => {
    const abertas = dash.transacoesFiltradas.filter(
      t => t.status !== 'Pago' && t.status !== 'Cancelado' && t.item
    );
    let contasAPagar = 0;
    let qtdAReceber = 0;
    let qtdAPagar = 0;
    for (const t of abertas) {
      const grupo = t.item!.grupo_principal;
      if (DESPESA_GROUPS.includes(grupo)) {
        contasAPagar += t.valor;
        qtdAPagar += 1;
      } else if (RECEITA_GROUPS.includes(grupo)) {
        qtdAReceber += 1;
      }
    }
    return { contasAPagar, qtdAReceber, qtdAPagar };
  }, [dash.transacoesFiltradas]);


  // Séries mensais reais para sparklines (A Receber / A Pagar) — status ≠ Pago/Cancelado
  const { aReceberMensal, aPagarMensal } = useMemo(() => {
    const buckets = new Map<number, { rec: number; pag: number }>();
    for (let m = 1; m <= 12; m++) buckets.set(m, { rec: 0, pag: 0 });
    for (const t of dash.transacoesFiltradas as any[]) {
      if (t.status === 'Pago' || t.status === 'Cancelado') continue;
      if (!t.item) continue;
      const mes = Number((t.dataVencimento || '').slice(5, 7));
      if (!mes) continue;
      const b = buckets.get(mes);
      if (!b) continue;
      if (RECEITA_GROUPS.includes(t.item.grupo_principal)) b.rec += t.valor;
      else if (DESPESA_GROUPS.includes(t.item.grupo_principal)) b.pag += t.valor;
    }
    const arr = Array.from(buckets.values());
    return { aReceberMensal: arr.map(b => b.rec), aPagarMensal: arr.map(b => b.pag) };
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
        aReceberMensal={aReceberMensal}
        aPagarMensal={aPagarMensal}
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
