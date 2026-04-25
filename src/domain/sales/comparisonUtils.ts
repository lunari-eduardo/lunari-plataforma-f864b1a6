/**
 * Utilities for Year-over-Year (YoY) comparison
 */

export interface ComparisonValue {
  current: number;
  previous: number;
  diffAbsolute: number;
  /** Percentage variation. null = "Novo" (previous=0 e current>0). 0 quando ambos = 0 */
  diffPercentage: number | null;
  isNew: boolean;
}

export interface ComparativeMetrics {
  totalRevenue: ComparisonValue;
  totalSessions: ComparisonValue;
  averageTicket: ComparisonValue;
  extraPhotosRevenue: ComparisonValue;
  expectedRevenue: ComparisonValue;
}

export interface ComparativeMonthlyDataPoint {
  month: string;
  monthIndex: number;
  revenueCurrent: number;
  revenuePrevious: number;
  sessionsCurrent: number;
  sessionsPrevious: number;
  averageTicketCurrent: number;
  averageTicketPrevious: number;
  extraPhotoRevenueCurrent: number;
  extraPhotoRevenuePrevious: number;
}

export function computeComparison(current: number, previous: number): ComparisonValue {
  const diffAbsolute = current - previous;

  if (previous === 0) {
    return {
      current,
      previous,
      diffAbsolute,
      diffPercentage: current > 0 ? null : 0,
      isNew: current > 0
    };
  }

  const diffPercentage = (diffAbsolute / previous) * 100;
  return {
    current,
    previous,
    diffAbsolute,
    diffPercentage: Math.round(diffPercentage * 10) / 10,
    isNew: false
  };
}

export function formatVariation(comp: ComparisonValue): string {
  if (comp.isNew) return 'Novo';
  if (comp.diffPercentage === null || comp.diffPercentage === 0) return '—';
  const sign = comp.diffPercentage > 0 ? '+' : '';
  return `${sign}${comp.diffPercentage.toFixed(1)}%`;
}
