/**
 * Refactored Sales Analytics Hook
 * Uses domain layer and repository pattern for clean architecture
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { SalesRepositoryImpl } from '@/domain/sales/SalesRepository';
import { SalesDataSourceFactory } from '@/domain/sales/salesDataSourceFactory';
import { SalesFilters, SalesAnalyticsResult } from '@/domain/sales/sales-domain';
import { useLeadMetrics } from '@/hooks/useLeadMetrics';

// Re-export domain types for backward compatibility
export type {
  SalesDomainMetrics as SalesMetrics,
  SalesMonthlyData as MonthlyData,
  SalesCategoryData as CategoryData,
  SalesPackageData as PackageDistributionData,
  SalesOriginData as OriginData
} from '@/domain/sales/sales-domain';

export function useSalesAnalyticsRefactored(
  selectedYear: number,
  selectedMonth: number | null,
  selectedCategory: string
) {
  // Create repository instance
  const repository = useMemo(() => {
    const dataSource = SalesDataSourceFactory.create({
      enableDebugLogs: import.meta.env.VITE_DEBUG_SALES === 'true'
    });
    return new SalesRepositoryImpl(dataSource);
  }, []);

  // Get real conversion rate from leads data
  const { metrics: leadMetrics } = useLeadMetrics({
    periodType: selectedYear === new Date().getFullYear() ? 'current_year' : 'all_time'
  });

  // Build filters
  const filters: SalesFilters = useMemo(() => ({
    year: selectedYear,
    month: selectedMonth,
    category: selectedCategory
  }), [selectedYear, selectedMonth, selectedCategory]);

  // Query sales analytics
  const {
    data: analyticsResult,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['sales-analytics', filters],
    queryFn: () => repository.getAnalytics(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2
  });

  // Override conversion rate with real data
  const salesMetrics = useMemo(() => {
    const defaultMetrics = {
      totalRevenue: 0,
      totalSessions: 0,
      averageTicket: 0,
      conversionRate: 0,
      extraPhotosRevenue: 0,
      additionalRevenue: 0,
      totalDiscount: 0,
      newClients: 0,
      monthlyGoalProgress: 0
    };
    
    if (!analyticsResult) return defaultMetrics;
    
    return {
      ...analyticsResult.metrics,
      conversionRate: leadMetrics.taxaConversao
    };
  }, [analyticsResult?.metrics, leadMetrics.taxaConversao]);

  // Log analytics status
  const filterDescription = selectedMonth !== null 
    ? `mês ${selectedMonth + 1}/${selectedYear}` 
    : `ano ${selectedYear}`;
  
  if (import.meta.env.VITE_DEBUG_SALES === 'true') {
    console.log(`🔍 [useSalesAnalyticsRefactored] Análise para ${filterDescription}, categoria: ${selectedCategory}`);
    
    if (analyticsResult) {
      console.log(`💰 [useSalesAnalyticsRefactored] Resultado: R$ ${analyticsResult.metrics.totalRevenue.toLocaleString()}, ${analyticsResult.metrics.totalSessions} sessões`);
    }
  }

  return {
    // Main metrics (with conversion rate override)
    salesMetrics,
    
    // Analytics data
    monthlyData: analyticsResult?.monthlyData || [],
    categoryData: analyticsResult?.categoryData || [],
    packageDistributionData: analyticsResult?.packageData || [],
    originData: analyticsResult?.originData || [],
    monthlyOriginData: analyticsResult?.monthlyOriginData || [],
    
    // Metadata
    availableYears: analyticsResult?.availableYears || [],
    availableCategories: analyticsResult?.availableCategories || [],
    filteredData: [], // Keep for compatibility, but empty for privacy
    
    // Query status
    isLoading,
    error,
    refetch,
    
    // Analytics metadata
    filteredDataCount: analyticsResult?.filteredDataCount || 0
  };
}