import { useMemo } from 'react';
import { SalesMetrics, MonthlyData, CategoryData, NormalizedWorkflowData } from '@/types/salesAnalytics';
import { normalizeWorkflowItems, generateAllMonthsData } from '@/utils/salesDataNormalizer';

// Re-export types for backward compatibility
export type { SalesMetrics, MonthlyData, CategoryData };

export function useSalesAnalytics(selectedYear: number, selectedCategory: string) {
  console.log(`🔍 [useSalesAnalytics] Iniciando análise para ano ${selectedYear}, categoria: ${selectedCategory}`);

  // Carregar e normalizar dados diretamente do localStorage
  const normalizedData = useMemo(() => {
    console.log(`📊 [useSalesAnalytics] Normalizando dados...`);
    return normalizeWorkflowItems();
  }, []);

  // Filter data by year and category
  const filteredData = useMemo(() => {
    const filtered = normalizedData.filter(item => {
      const yearMatch = item.year === selectedYear;
      const categoryMatch = selectedCategory === 'all' || item.categoria === selectedCategory;
      
      return yearMatch && categoryMatch;
    });
    
    console.log(`🔍 [useSalesAnalytics] ${filtered.length} sessões filtradas para ${selectedYear}/${selectedCategory}`);
    return filtered;
  }, [normalizedData, selectedYear, selectedCategory]);

  // Calculate main metrics
  const salesMetrics = useMemo((): SalesMetrics => {
    const totalRevenue = filteredData.reduce((sum, item) => sum + item.total, 0);
    const totalSessions = filteredData.length;
    const averageTicket = totalSessions > 0 ? totalRevenue / totalSessions : 0;
    
    // Count unique clients (by email/phone)
    const uniqueClients = new Set(
      filteredData.map(item => item.email || item.whatsapp).filter(Boolean)
    ).size;
    
    // Calculate goal progress (assuming monthly goal of R$ 50k)
    const currentMonth = new Date().getMonth();
    const currentMonthRevenue = filteredData
      .filter(item => item.month === currentMonth)
      .reduce((sum, item) => sum + item.total, 0);
    
    const monthlyGoal = 50000;
    const monthlyGoalProgress = (currentMonthRevenue / monthlyGoal) * 100;
    
    // Simple conversion rate estimate (70% average)
    const conversionRate = 68;

    console.log(`💰 [useSalesAnalytics] Métricas calculadas: R$ ${totalRevenue.toLocaleString()}, ${totalSessions} sessões, ${uniqueClients} clientes únicos`);

    return {
      totalRevenue,
      totalSessions,
      averageTicket,
      newClients: uniqueClients,
      monthlyGoalProgress,
      conversionRate
    };
  }, [filteredData]);

  // Calculate monthly data - SEMPRE TODOS OS 12 MESES
  const monthlyData = useMemo((): MonthlyData[] => {
    console.log(`📅 [useSalesAnalytics] Calculando dados mensais para ${selectedYear}`);
    
    const allMonthsData = generateAllMonthsData(selectedYear, filteredData);
    
    // Debug: Log resumo dos dados mensais
    const totalRevenue = allMonthsData.reduce((sum, month) => sum + month.revenue, 0);
    const totalSessions = allMonthsData.reduce((sum, month) => sum + month.sessions, 0);
    const monthsWithData = allMonthsData.filter(month => month.sessions > 0).length;
    
    console.log(`📊 [useSalesAnalytics] Dados mensais: ${monthsWithData}/12 meses com dados, Total: R$ ${totalRevenue.toLocaleString()}, ${totalSessions} sessões`);
    
    return allMonthsData;
  }, [selectedYear, filteredData]);

  // Calculate category distribution
  const categoryData = useMemo((): CategoryData[] => {
    console.log(`🏷️ [useSalesAnalytics] Calculando distribuição por categoria`);
    
    const categoryStats = new Map<string, { sessions: number; revenue: number }>();

    filteredData.forEach(item => {
      const category = item.categoria || 'Não categorizado';
      const current = categoryStats.get(category) || { sessions: 0, revenue: 0 };
      
      categoryStats.set(category, {
        sessions: current.sessions + 1,
        revenue: current.revenue + item.total
      });
    });

    const totalRevenue = Array.from(categoryStats.values())
      .reduce((sum, cat) => sum + cat.revenue, 0);

    const categories = Array.from(categoryStats.entries()).map(([name, stats]) => ({
      name,
      sessions: stats.sessions,
      revenue: stats.revenue,
      percentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);
    
    console.log(`🏷️ [useSalesAnalytics] ${categories.length} categorias encontradas`);
    return categories;
  }, [filteredData]);

  // Get available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    normalizedData.forEach(item => {
      years.add(item.year);
    });
    
    if (years.size === 0) {
      years.add(new Date().getFullYear());
    }
    
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    console.log(`📅 [useSalesAnalytics] Anos disponíveis: ${sortedYears.join(', ')}`);
    return sortedYears;
  }, [normalizedData]);

  // Get available categories
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    normalizedData.forEach(item => {
      if (item.categoria) {
        categories.add(item.categoria);
      }
    });
    const sortedCategories = Array.from(categories).sort();
    console.log(`🏷️ [useSalesAnalytics] Categorias disponíveis: ${sortedCategories.join(', ')}`);
    return sortedCategories;
  }, [normalizedData]);

  return {
    salesMetrics,
    monthlyData,
    categoryData,
    availableYears,
    availableCategories,
    filteredData
  };
}