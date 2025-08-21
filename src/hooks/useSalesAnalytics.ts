import { useMemo } from 'react';
import { SalesMetrics, MonthlyData, CategoryData, PackageDistributionData, OriginData, NormalizedWorkflowData } from '@/types/salesAnalytics';
import { normalizeWorkflowItems, generateAllMonthsData } from '@/utils/salesDataNormalizer';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { revenueAnalyticsService, MonthlyOriginData } from '@/services/RevenueAnalyticsService';
import { useLeadMetrics } from '@/hooks/useLeadMetrics';

// Re-export types for backward compatibility
export type { SalesMetrics, MonthlyData, CategoryData, PackageDistributionData, OriginData };

export function useSalesAnalytics(
  selectedYear: number,
  selectedMonth: number | null, // null = all months, 0-11 = specific months  
  selectedCategory: string
) {
  const filterByMonth = selectedMonth !== null;
  const targetMonth = selectedMonth; // 0-11 or null
  
  console.log(`🔍 [useSalesAnalytics] Iniciando análise para ${filterByMonth ? `mês ${targetMonth! + 1}/${selectedYear}` : `ano ${selectedYear}`}, categoria: ${selectedCategory}`);

  // Get real conversion rate from leads data for the selected year
  const { metrics: leadMetrics } = useLeadMetrics({
    periodType: selectedYear === new Date().getFullYear() ? 'current_year' : 'all_time'
  });

  // Carregar e normalizar dados diretamente do localStorage
  const normalizedData = useMemo(() => {
    console.log(`📊 [useSalesAnalytics] Normalizando dados...`);
    return normalizeWorkflowItems();
  }, []);

  // Filter data by year/month and category
  const filteredData = useMemo(() => {
    const filtered = normalizedData.filter(item => {
      const yearMatch = item.year === selectedYear;
      const monthMatch = !filterByMonth || item.month === targetMonth;
      const categoryMatch = selectedCategory === 'all' || item.categoria === selectedCategory;
      
      return yearMatch && monthMatch && categoryMatch;
    });
    
    const period = filterByMonth ? `${targetMonth! + 1}/${selectedYear}` : `${selectedYear}`;
    console.log(`🔍 [useSalesAnalytics] ${filtered.length} sessões filtradas para ${period}/${selectedCategory}`);
    return filtered;
  }, [normalizedData, selectedYear, targetMonth, filterByMonth, selectedCategory]);

  // Calculate main metrics
  const salesMetrics = useMemo((): SalesMetrics => {
    const totalRevenue = filteredData.reduce((sum, item) => sum + item.valorPago, 0);
    const totalSessions = filteredData.length;
    const averageTicket = totalSessions > 0 ? totalRevenue / totalSessions : 0;
    
    // Count unique clients (by email/phone)
    const uniqueClients = new Set(
      filteredData.map(item => item.email || item.whatsapp).filter(Boolean)
    ).size;
    
    // Calculate goal progress (assuming monthly goal of R$ 50k)
    const monthlyGoal = 50000;
    let monthlyGoalProgress = 0;
    
    if (filterByMonth) {
      // For specific month, use filtered data total
      monthlyGoalProgress = (totalRevenue / monthlyGoal) * 100;
    } else {
      // For yearly view, use current month
      const currentMonth = new Date().getMonth();
      const currentMonthRevenue = filteredData
        .filter(item => item.month === currentMonth)
        .reduce((sum, item) => sum + item.valorPago, 0);
      monthlyGoalProgress = (currentMonthRevenue / monthlyGoal) * 100;
    }
    
    // Use real conversion rate from leads data
    const conversionRate = leadMetrics.taxaConversao;

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
    
    const categoryStats = new Map<string, { 
      sessions: number; 
      revenue: number; 
      totalExtraPhotos: number;
      packages: Map<string, number>;
    }>();

    filteredData.forEach(item => {
      const category = item.categoria || 'Não categorizado';
      const current = categoryStats.get(category) || { 
        sessions: 0, 
        revenue: 0, 
        totalExtraPhotos: 0,
        packages: new Map()
      };
      
      // Contabilizar pacotes
      const packageName = item.pacote || 'Sem pacote';
      current.packages.set(packageName, (current.packages.get(packageName) || 0) + 1);
      
      categoryStats.set(category, {
        sessions: current.sessions + 1,
        revenue: current.revenue + item.valorPago,
        totalExtraPhotos: current.totalExtraPhotos + (item.qtdFotosExtra || 0),
        packages: current.packages
      });
    });

    const totalRevenue = Array.from(categoryStats.values())
      .reduce((sum, cat) => sum + cat.revenue, 0);

    const categories = Array.from(categoryStats.entries()).map(([name, stats]) => {
      // Calcular distribuição de pacotes
      const totalPackages = Array.from(stats.packages.values()).reduce((sum, count) => sum + count, 0);
      const packageDistribution = Array.from(stats.packages.entries()).map(([packageName, count]) => ({
        packageName,
        count,
        percentage: totalPackages > 0 ? (count / totalPackages) * 100 : 0
      })).sort((a, b) => b.count - a.count);

      return {
        name,
        sessions: stats.sessions,
        revenue: stats.revenue,
        percentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
        totalExtraPhotos: stats.totalExtraPhotos,
        packageDistribution
      };
    }).sort((a, b) => b.revenue - a.revenue);
    
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

  // Calculate package distribution
  const packageDistributionData = useMemo((): PackageDistributionData[] => {
    console.log(`📦 [useSalesAnalytics] Calculando distribuição de pacotes para categoria: ${selectedCategory}`);
    
    const packageStats = new Map<string, { sessions: number; revenue: number }>();
    
    filteredData.forEach(item => {
      const packageName = item.pacote || 'Sem pacote';
      const current = packageStats.get(packageName) || { sessions: 0, revenue: 0 };
      packageStats.set(packageName, {
        sessions: current.sessions + 1,
        revenue: current.revenue + item.valorPago
      });
    });

    const totalSessions = filteredData.length;
    const packages = Array.from(packageStats.entries()).map(([name, stats]) => ({
      name,
      sessions: stats.sessions,
      revenue: stats.revenue,
      percentage: totalSessions > 0 ? (stats.sessions / totalSessions) * 100 : 0
    })).sort((a, b) => b.sessions - a.sessions);
    
    console.log(`📦 [useSalesAnalytics] ${packages.length} pacotes encontrados`);
    return packages;
  }, [filteredData, selectedCategory]);

  // Calculate origin distribution using RevenueAnalyticsService
  const originData = useMemo((): OriginData[] => {
    console.log(`🎯 [useSalesAnalytics] Calculando distribuição por origem com RevenueAnalyticsService`);
    
    try {
      // Importar o serviço dinamicamente para evitar circular imports
      import('@/services/RevenueAnalyticsService').then(({ revenueAnalyticsService }) => {
        const result = revenueAnalyticsService.generateClientOriginMatrix(selectedYear, selectedCategory);
        console.log(`📊 [useSalesAnalytics] RevenueAnalytics: ${result.originSummary.length} origens, R$ ${result.totalRevenue.toLocaleString()}`);
      });
    } catch (error) {
      console.warn('⚠️ [useSalesAnalytics] Fallback para cálculo manual de origem:', error);
    }

    // Cálculo manual (fallback + dados consistentes)
    const originStats = new Map<string, { sessions: number; revenue: number }>();
    
    filteredData.forEach(item => {
      const originKey = item.origem || 'nao-especificado';
      const current = originStats.get(originKey) || { sessions: 0, revenue: 0 };
      originStats.set(originKey, {
        sessions: current.sessions + 1,
        revenue: current.revenue + item.valorPago
      });
    });

    const totalSessions = filteredData.length;
    const origins = Array.from(originStats.entries()).map(([originKey, stats]) => {
      // Find matching origin from defaults or create fallback
      const matchingOrigin = ORIGENS_PADRAO.find(o => o.id === originKey);
      const name = matchingOrigin?.nome || (originKey === 'nao-especificado' ? 'Não especificado' : originKey);
      const color = matchingOrigin?.cor || 'hsl(var(--muted-foreground))';

      return {
        name,
        sessions: stats.sessions,
        revenue: stats.revenue,
        percentage: totalSessions > 0 ? (stats.sessions / totalSessions) * 100 : 0,
        color
      };
    }).sort((a, b) => b.sessions - a.sessions);
    
    console.log(`🎯 [useSalesAnalytics] ${origins.length} origens encontradas`, 
      origins.map(o => `${o.name}: ${o.sessions} sessões, R$ ${o.revenue.toLocaleString()}`));
    return origins;
  }, [filteredData, selectedYear, selectedCategory]);

  // Calculate monthly origin data for timeline chart
  const monthlyOriginData = useMemo((): MonthlyOriginData[] => {
    console.log(`📈 [useSalesAnalytics] Calculando dados mensais por origem para timeline`);
    
    try {
      const result = revenueAnalyticsService.generateMonthlyOriginData(selectedYear, selectedCategory);
      console.log(`📊 [useSalesAnalytics] Timeline gerada com ${result.length} meses de dados`);
      return result;
    } catch (error) {
      console.error('❌ [useSalesAnalytics] Erro ao gerar dados mensais por origem:', error);
      return [];
    }
  }, [selectedYear, selectedCategory]);

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
    packageDistributionData,
    originData,
    monthlyOriginData,
    availableYears,
    availableCategories,
    filteredData
  };
}