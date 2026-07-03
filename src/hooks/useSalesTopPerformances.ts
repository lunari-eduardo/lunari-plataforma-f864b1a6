import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MetricResult {
  subtitle: string;
  value: string;
  hasData: boolean;
}

interface TopPerformancesResult {
  melhorMes: MetricResult;
  melhorServico: MetricResult;
  clienteFidelizado: MetricResult;
  isLoading: boolean;
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1).replace('.', ',')}k`;
  }
  return `R$ ${value.toFixed(0)}`;
}

export function useSalesTopPerformances(
  selectedYear: number,
  selectedMonth: number | null,
  selectedCategory: string
): TopPerformancesResult {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-top-performances', selectedYear, selectedMonth, selectedCategory],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Para "Melhor Mês" precisamos do ano todo; para os outros respeita o mês.
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      let query = supabase
        .from('clientes_sessoes')
        .select('data_sessao, valor_total, categoria, pacote, cliente_id, tipo_registro, cliente:clientes(nome)')
        .eq('user_id', user.id)
        .gte('data_sessao', yearStart)
        .lte('data_sessao', yearEnd);

      if (selectedCategory && selectedCategory !== 'all') {
        query = query.eq('categoria', selectedCategory);
      }

      const { data: sessoes, error } = await query;
      if (error) throw error;
      return sessoes || [];
    },
  });

  if (isLoading || !data) {
    return {
      melhorMes: { subtitle: '', value: '', hasData: false },
      melhorServico: { subtitle: '', value: '', hasData: false },
      clienteFidelizado: { subtitle: '', value: '', hasData: false },
      isLoading: true,
    };
  }

  // ===== 1. MELHOR MÊS (ano todo, ignora selectedMonth) =====
  const porMes: Record<number, number> = {};
  data.forEach((s: any) => {
    if (!s.data_sessao) return;
    const mes = new Date(s.data_sessao + 'T12:00:00').getMonth();
    porMes[mes] = (porMes[mes] || 0) + Number(s.valor_total || 0);
  });

  const mesesComDados = Object.entries(porMes).filter(([, v]) => v > 0);
  let melhorMes: MetricResult = { subtitle: 'Sem dados no período', value: '', hasData: false };
  if (mesesComDados.length > 0) {
    const [topMesIdx, topValor] = mesesComDados.reduce((max, cur) =>
      cur[1] > max[1] ? cur : max
    );
    const mesNum = Number(topMesIdx);
    const subtitle = `${MESES_PT[mesNum]} ${selectedYear}`;

    if (mesesComDados.length === 1) {
      melhorMes = { subtitle, value: formatCurrency(topValor), hasData: true };
    } else {
      const outrosMeses = mesesComDados.filter(([idx]) => Number(idx) !== mesNum);
      const mediaOutros = outrosMeses.reduce((s, [, v]) => s + v, 0) / outrosMeses.length;
      const variacao = mediaOutros > 0 ? ((topValor - mediaOutros) / mediaOutros) * 100 : 0;
      const sinal = variacao >= 0 ? '+' : '';
      melhorMes = { subtitle, value: `${sinal}${variacao.toFixed(0)}%`, hasData: true };
    }
  }

  // ===== Filtrar por mês se especificado para os próximos 2 cards =====
  const dataFiltrada = selectedMonth !== null
    ? data.filter((s: any) => {
        if (!s.data_sessao) return false;
        return new Date(s.data_sessao + 'T12:00:00').getMonth() === selectedMonth;
      })
    : data;

  // ===== 2. MELHOR SERVIÇO =====
  const porServico: Record<string, number> = {};
  dataFiltrada.forEach((s: any) => {
    const nome = s.categoria || s.pacote || 'Outros';
    porServico[nome] = (porServico[nome] || 0) + Number(s.valor_total || 0);
  });

  const servicosOrdenados = Object.entries(porServico)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const melhorServico: MetricResult = servicosOrdenados.length > 0
    ? { subtitle: servicosOrdenados[0][0], value: formatCurrency(servicosOrdenados[0][1]), hasData: true }
    : { subtitle: 'Sem dados no período', value: '', hasData: false };

  // ===== 3. CLIENTE FIDELIZADO (apenas tipo_registro='workflow') =====
  const porCliente: Record<string, { nome: string; count: number }> = {};
  dataFiltrada
    .filter((s: any) => s.tipo_registro === 'workflow' && s.cliente_id)
    .forEach((s: any) => {
      const id = s.cliente_id;
      const nome = s.cliente?.nome || 'Cliente sem nome';
      if (!porCliente[id]) porCliente[id] = { nome, count: 0 };
      porCliente[id].count += 1;
    });

  const clientesOrdenados = Object.values(porCliente).sort((a, b) => b.count - a.count);
  const clienteFidelizado: MetricResult = clientesOrdenados.length > 0
    ? {
        subtitle: clientesOrdenados[0].nome,
        value: `${clientesOrdenados[0].count} ${clientesOrdenados[0].count === 1 ? 'sessão' : 'sessões'}`,
        hasData: true,
      }
    : { subtitle: 'Sem dados no período', value: '', hasData: false };

  return { melhorMes, melhorServico, clienteFidelizado, isLoading: false };
}
