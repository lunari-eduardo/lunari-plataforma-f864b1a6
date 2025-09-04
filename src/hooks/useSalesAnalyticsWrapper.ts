/**
 * Sales Analytics Wrapper Hook
 * Provides backward compatibility while implementing feature flag
 */

import { useSalesAnalytics as useOriginalSalesAnalytics } from '@/hooks/useSalesAnalytics';
import { useSalesAnalyticsRefactored } from '@/hooks/useSalesAnalyticsRefactored';

export function useSalesAnalytics(
  selectedYear: number,
  selectedMonth: number | null,
  selectedCategory: string
) {
  // Feature flag to enable new architecture
  const useRefactoredVersion = import.meta.env.VITE_USE_REFACTORED_SALES === 'true';
  
  if (useRefactoredVersion) {
    console.log('🔄 [SalesAnalyticsWrapper] Using refactored sales analytics');
    return useSalesAnalyticsRefactored(selectedYear, selectedMonth, selectedCategory);
  }
  
  // Default to original implementation
  console.log('📊 [SalesAnalyticsWrapper] Using original sales analytics');
  return useOriginalSalesAnalytics(selectedYear, selectedMonth, selectedCategory);
}