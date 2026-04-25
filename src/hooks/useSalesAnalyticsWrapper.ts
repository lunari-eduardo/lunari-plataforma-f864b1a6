/**
 * Sales Analytics Wrapper Hook
 * Uses Supabase data source for real-time sales data
 */

import { useSalesAnalyticsRefactored } from '@/hooks/useSalesAnalyticsRefactored';

export function useSalesAnalytics(
  selectedYear: number,
  selectedMonth: number | null,
  selectedCategory: string,
  comparisonOptions?: { enabled: boolean; comparisonYear: number | null }
) {
  return useSalesAnalyticsRefactored(selectedYear, selectedMonth, selectedCategory, comparisonOptions);
}
