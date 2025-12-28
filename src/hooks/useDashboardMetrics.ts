import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TopCategoria {
  name: string;
  revenue: number;
  sessions: number;
}

interface DashboardMetrics {
  receitaMes: number;
  valorPrevisto: number;
  metaMes: number;
  progressoMeta: number;
  topCategoria: TopCategoria | null;
  novosClientes60d: number;
  isLoading: boolean;
}

export function useDashboardMetrics(): DashboardMetrics {
  const [receitaMes, setReceitaMes] = useState(0);
  const [valorPrevisto, setValorPrevisto] = useState(0);
  const [metaMes, setMetaMes] = useState(0);
  const [topCategoria, setTopCategoria] = useState<TopCategoria | null>(null);
  const [novosClientes60d, setNovosClientes60d] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        // Datas para filtros
        const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(currentYear, currentMonth, 0).getDate();
        const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${lastDay}`;
        const yearStart = `${currentYear}-01-01`;
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        // Executar todas as queries em paralelo
        const [
          monthlyResult,
          categoryResult,
          clientsResult,
          goalsResult
        ] = await Promise.all([
          // 1. Receita + Previsto do mês atual
          supabase
            .from('clientes_sessoes')
            .select('valor_pago, valor_total')
            .eq('user_id', user.id)
            .neq('status', 'cancelado')
            .gte('data_sessao', monthStart)
            .lte('data_sessao', monthEnd),
          
          // 2. Categoria mais rentável do ano inteiro
          supabase
            .from('clientes_sessoes')
            .select('categoria, valor_pago')
            .eq('user_id', user.id)
            .neq('status', 'cancelado')
            .gte('data_sessao', yearStart),
          
          // 3. Novos clientes nos últimos 60 dias
          supabase
            .from('clientes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', sixtyDaysAgo.toISOString()),
          
          // 4. Meta mensal (pricing_configuracoes)
          supabase
            .from('pricing_configuracoes')
            .select('meta_faturamento_anual')
            .eq('user_id', user.id)
            .single()
        ]);

        // Processar resultados

        // 1. Receita e Previsto do mês
        if (monthlyResult.data) {
          const receita = monthlyResult.data.reduce((sum, s) => sum + (Number(s.valor_pago) || 0), 0);
          const previsto = monthlyResult.data.reduce((sum, s) => sum + (Number(s.valor_total) || 0), 0);
          setReceitaMes(receita);
          setValorPrevisto(previsto);
        }

        // 2. Categoria mais rentável (agregação manual)
        if (categoryResult.data && categoryResult.data.length > 0) {
          const categoryMap = new Map<string, { revenue: number; sessions: number }>();
          
          categoryResult.data.forEach(session => {
            const cat = session.categoria || 'Sem categoria';
            const existing = categoryMap.get(cat) || { revenue: 0, sessions: 0 };
            categoryMap.set(cat, {
              revenue: existing.revenue + (Number(session.valor_pago) || 0),
              sessions: existing.sessions + 1
            });
          });

          // Encontrar categoria com maior receita
          let topCat: TopCategoria | null = null;
          let maxRevenue = 0;
          
          categoryMap.forEach((data, name) => {
            if (data.revenue > maxRevenue) {
              maxRevenue = data.revenue;
              topCat = { name, revenue: data.revenue, sessions: data.sessions };
            }
          });
          
          setTopCategoria(topCat);
        }

        // 3. Novos clientes
        if (clientsResult.count !== null) {
          setNovosClientes60d(clientsResult.count);
        }

        // 4. Meta mensal
        if (goalsResult.data?.meta_faturamento_anual) {
          setMetaMes(goalsResult.data.meta_faturamento_anual / 12);
        }

      } catch (error) {
        console.error('❌ [useDashboardMetrics] Error loading metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();

    // Realtime subscriptions para atualizar automaticamente
    const channel = supabase
      .channel('dashboard-metrics')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_sessoes'
      }, () => {
        loadMetrics();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_transacoes'
      }, () => {
        loadMetrics();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes'
      }, () => {
        loadMetrics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Calcular progresso da meta
  const progressoMeta = useMemo(() => {
    if (metaMes <= 0) return 0;
    return Math.min(100, (receitaMes / metaMes) * 100);
  }, [receitaMes, metaMes]);

  return {
    receitaMes,
    valorPrevisto,
    metaMes,
    progressoMeta,
    topCategoria,
    novosClientes60d,
    isLoading
  };
}
