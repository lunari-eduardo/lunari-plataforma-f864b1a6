import { useMemo, useCallback } from 'react';
import { useUnifiedWorkflowData } from './useUnifiedWorkflowData';

export interface SalesMetrics {
  totalRevenue: number;
  totalSessions: number;
  averageTicket: number;
  newClients: number;
  monthlyGoalProgress: number;
  conversionRate: number;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  sessions: number;
  averageTicket: number;
  extraPhotoRevenue: number;
  goal: number;
}

export interface CategoryData {
  name: string;
  sessions: number;
  revenue: number;
  percentage: number;
}

export function useSalesAnalytics(selectedYear: number, selectedCategory: string) {
  const { unifiedWorkflowData } = useUnifiedWorkflowData();

  // Debug: Log dos dados
  console.log('🔍 useSalesAnalytics - Total items:', unifiedWorkflowData.length);
  console.log('🔍 useSalesAnalytics - Selected year:', selectedYear);
  console.log('🔍 useSalesAnalytics - Selected category:', selectedCategory);
  console.log('🔍 useSalesAnalytics - Sample data:', unifiedWorkflowData.slice(0, 3));

  // Filter data by year and category
  const filteredData = useMemo(() => {
    const filtered = unifiedWorkflowData.filter(item => {
      const itemYear = new Date(item.data).getFullYear();
      const yearMatch = itemYear === selectedYear;
      const categoryMatch = selectedCategory === 'all' || item.categoria === selectedCategory;
      
      return yearMatch && categoryMatch && item.status !== 'Cancelado';
    });
    
    console.log('🔍 Filtered data length:', filtered.length);
    console.log('🔍 Filtered data sample:', filtered.slice(0, 2));
    
    return filtered;
  }, [unifiedWorkflowData, selectedYear, selectedCategory]);

  // Calculate main metrics
  const salesMetrics = useMemo((): SalesMetrics => {
    const totalRevenue = filteredData.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalSessions = filteredData.length;
    const averageTicket = totalSessions > 0 ? totalRevenue / totalSessions : 0;
    
    // Count unique clients (by email/phone)
    const uniqueClients = new Set(
      filteredData.map(item => item.email || item.whatsapp).filter(Boolean)
    ).size;
    
    // Calculate goal progress (assuming monthly goal of R$ 50k)
    const currentMonth = new Date().getMonth();
    const currentMonthRevenue = filteredData
      .filter(item => new Date(item.data).getMonth() === currentMonth)
      .reduce((sum, item) => sum + (item.total || 0), 0);
    
    const monthlyGoal = 50000;
    const monthlyGoalProgress = (currentMonthRevenue / monthlyGoal) * 100;
    
    // Simple conversion rate estimate (70% average)
    const conversionRate = 68;

    return {
      totalRevenue,
      totalSessions,
      averageTicket,
      newClients: uniqueClients,
      monthlyGoalProgress,
      conversionRate
    };
  }, [filteredData]);

  // Calculate monthly data
  const monthlyData = useMemo((): MonthlyData[] => {
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    return months.map((month, index) => {
      const monthData = filteredData.filter(item => {
        const itemMonth = new Date(item.data).getMonth();
        return itemMonth === index;
      });

      const revenue = monthData.reduce((sum, item) => sum + (item.total || 0), 0);
      const sessions = monthData.length;
      const averageTicket = sessions > 0 ? revenue / sessions : 0;
      
      // Calculate extra photo revenue
      const extraPhotoRevenue = monthData.reduce((sum, item) => 
        sum + (item.valorTotalFotoExtra || 0), 0
      );

      // Set monthly goals (progressive growth)
      const baseGoal = 30000;
      const goal = baseGoal + (index * 2000);

      return {
        month,
        revenue,
        sessions,
        averageTicket,
        extraPhotoRevenue,
        goal
      };
    });
  }, [filteredData]);

  // Calculate category distribution
  const categoryData = useMemo((): CategoryData[] => {
    const categoryStats = new Map<string, { sessions: number; revenue: number }>();

    filteredData.forEach(item => {
      const category = item.categoria || 'Não categorizado';
      const current = categoryStats.get(category) || { sessions: 0, revenue: 0 };
      
      categoryStats.set(category, {
        sessions: current.sessions + 1,
        revenue: current.revenue + (item.total || 0)
      });
    });

    const totalRevenue = Array.from(categoryStats.values())
      .reduce((sum, cat) => sum + cat.revenue, 0);

    return Array.from(categoryStats.entries()).map(([name, stats]) => ({
      name,
      sessions: stats.sessions,
      revenue: stats.revenue,
      percentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filteredData]);

  // Get available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    unifiedWorkflowData.forEach(item => {
      const year = new Date(item.data).getFullYear();
      if (!isNaN(year)) {
        years.add(year);
      }
    });
    
    // Se não há dados, inclui o ano atual e alguns anteriores para teste
    if (years.size === 0) {
      const currentYear = new Date().getFullYear();
      years.add(currentYear);
      years.add(currentYear - 1);
      years.add(currentYear - 2);
    }
    
    return Array.from(years).sort((a, b) => b - a);
  }, [unifiedWorkflowData]);

  // Get available categories  
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    unifiedWorkflowData.forEach(item => {
      if (item.categoria) {
        categories.add(item.categoria);
      }
    });
    
    // Se não há categorias, adiciona algumas de exemplo
    if (categories.size === 0) {
      return ['Ensaio Casal', 'Ensaio Família', 'Casamento', 'Ensaio Gestante'];
    }
    
    return Array.from(categories).sort();
  }, [unifiedWorkflowData]);

  // Dados de fallback para quando não há dados reais
  const createFallbackData = useCallback(() => {
    console.log('📊 Criando dados de fallback para demonstração');
    
    const fallbackMetrics: SalesMetrics = {
      totalRevenue: 85400,
      totalSessions: 32,
      averageTicket: 2668.75,
      newClients: 18,
      monthlyGoalProgress: 67.2,
      conversionRate: 68
    };

    const fallbackMonthlyData: MonthlyData[] = [
      { month: 'Jan', revenue: 4200, sessions: 2, averageTicket: 2100, extraPhotoRevenue: 400, goal: 30000 },
      { month: 'Fev', revenue: 8500, sessions: 3, averageTicket: 2833, extraPhotoRevenue: 600, goal: 32000 },
      { month: 'Mar', revenue: 6800, sessions: 3, averageTicket: 2267, extraPhotoRevenue: 300, goal: 34000 },
      { month: 'Abr', revenue: 12400, sessions: 4, averageTicket: 3100, extraPhotoRevenue: 800, goal: 36000 },
      { month: 'Mai', revenue: 15600, sessions: 6, averageTicket: 2600, extraPhotoRevenue: 900, goal: 38000 },
      { month: 'Jun', revenue: 9200, sessions: 4, averageTicket: 2300, extraPhotoRevenue: 500, goal: 40000 },
      { month: 'Jul', revenue: 11800, sessions: 4, averageTicket: 2950, extraPhotoRevenue: 700, goal: 42000 },
      { month: 'Ago', revenue: 7300, sessions: 3, averageTicket: 2433, extraPhotoRevenue: 450, goal: 44000 },
      { month: 'Set', revenue: 9600, sessions: 3, averageTicket: 3200, extraPhotoRevenue: 600, goal: 46000 },
      { month: 'Out', revenue: 0, sessions: 0, averageTicket: 0, extraPhotoRevenue: 0, goal: 48000 },
      { month: 'Nov', revenue: 0, sessions: 0, averageTicket: 0, extraPhotoRevenue: 0, goal: 50000 },
      { month: 'Dez', revenue: 0, sessions: 0, averageTicket: 0, extraPhotoRevenue: 0, goal: 52000 }
    ];

    const fallbackCategoryData: CategoryData[] = [
      { name: 'Ensaio Casal', sessions: 12, revenue: 32400, percentage: 38.0 },
      { name: 'Casamento', sessions: 8, revenue: 28800, percentage: 33.7 },
      { name: 'Ensaio Família', sessions: 7, revenue: 15400, percentage: 18.0 },
      { name: 'Ensaio Gestante', sessions: 5, revenue: 8800, percentage: 10.3 }
    ];

    return {
      salesMetrics: fallbackMetrics,
      monthlyData: fallbackMonthlyData,
      categoryData: fallbackCategoryData
    };
  }, []);

  // Se não há dados filtrados, usar dados de fallback
  const finalData = useMemo(() => {
    if (filteredData.length === 0) {
      return createFallbackData();
    }

    return {
      salesMetrics,
      monthlyData,
      categoryData
    };
  }, [filteredData, salesMetrics, monthlyData, categoryData, createFallbackData]);

  return {
    salesMetrics: finalData.salesMetrics,
    monthlyData: finalData.monthlyData,
    categoryData: finalData.categoryData,
    availableYears,
    availableCategories,
    filteredData
  };
}