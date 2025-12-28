/**
 * Sales Analytics Wrapper Hook
 * Uses Supabase data source for real-time sales data
 */

import { useSalesAnalyticsRefactored } from '@/hooks/useSalesAnalyticsRefactored';

export function useSalesAnalytics(
  selectedYear: number,
  selectedMonth: number | null,
  selectedCategory: string
) {
  // Always use refactored version with Supabase data source
  return useSalesAnalyticsRefactored(selectedYear, selectedMonth, selectedCategory);
}