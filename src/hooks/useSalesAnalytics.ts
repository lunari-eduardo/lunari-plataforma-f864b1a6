import { useMemo } from 'react';
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

  // Filter data by year and category
  const filteredData = useMemo(() => {
    return unifiedWorkflowData.filter(item => {
      const itemYear = new Date(item.data).getFullYear();
      const yearMatch = itemYear === selectedYear;
      const categoryMatch = selectedCategory === 'all' || item.categoria === selectedCategory;
      
      return yearMatch && categoryMatch && item.status !== 'Cancelado';
    });
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
    
    if (years.size === 0) {
      years.add(new Date().getFullYear());
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
    return Array.from(categories).sort();
  }, [unifiedWorkflowData]);

  return {
    salesMetrics,
    monthlyData,
    categoryData,
    availableYears,
    availableCategories,
    filteredData
  };
}