/**
 * Sales Domain Types
 * Clean domain layer for sales analytics, compatible with Supabase migration
 */

export interface SalesDomainMetrics {
  totalRevenue: number;
  totalSessions: number;
  averageTicket: number;
  newClients: number;
  monthlyGoalProgress: number;
  conversionRate: number;
  // Extended metrics
  extraPhotosRevenue?: number;
  additionalRevenue?: number;
  totalDiscount?: number;
  expectedRevenue?: number;
  pendingRevenue?: number;
}

export interface SalesMonthlyData {
  month: string;
  monthIndex: number;
  revenue: number;
  sessions: number;
  averageTicket: number;
  extraPhotoRevenue: number;
  goal: number;
}

export interface SalesCategoryData {
  name: string;
  sessions: number;
  revenue: number;
  percentage: number;
  totalExtraPhotos: number;
  packageDistribution: SalesPackageDistribution[];
}

export interface SalesPackageDistribution {
  packageName: string;
  count: number;
  percentage: number;
}

export interface SalesPackageData {
  name: string;
  sessions: number;
  revenue: number;
  percentage: number;
}

export interface SalesOriginData {
  name: string;
  sessions: number;
  revenue: number;
  percentage: number;
  color: string;
}

export interface SalesMonthlyOriginData {
  month: string;
  monthIndex: number;
  [originId: string]: number | string;
  totalSessions: number;
}

export interface SalesFilters {
  year: number;
  month: number | null; // null = all months, 0-11 = specific month
  category: string; // 'all' or specific category
  /** Optional comparison year (YoY). When set, repository returns comparativeData */
  comparisonYear?: number | null;
  /** Optional inclusive month limit (0-11) applied to BOTH base and comparison years for fair YoY comparison */
  comparisonLimitMonth?: number | null;
}

export interface SalesAnalyticsResult {
  metrics: SalesDomainMetrics;
  monthlyData: SalesMonthlyData[];
  categoryData: SalesCategoryData[];
  packageData: SalesPackageData[];
  originData: SalesOriginData[];
  monthlyOriginData: SalesMonthlyOriginData[];
  availableYears: number[];
  availableCategories: string[];
  filteredDataCount: number;
  /** Populated when filters.comparisonYear is set */
  comparison?: SalesComparisonResult | null;
}

export interface SalesComparisonResult {
  baseYear: number;
  comparisonYear: number;
  metrics: import('./comparisonUtils').ComparativeMetrics;
  monthlyData: import('./comparisonUtils').ComparativeMonthlyDataPoint[];
  previousMetrics: SalesDomainMetrics;
  /** Inclusive month limit (0-11) used for the equivalent-period comparison */
  limitMonth: number;
}

export interface SalesSession {
  id: string;
  sessionId: string;
  date: string; // YYYY-MM-DD format
  time: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  description: string;
  status: string;
  category: string;
  package: string;
  packageValue: number;
  discount: number;
  extraPhotoValue: number;
  extraPhotoCount: number;
  totalExtraPhotoValue: number;
  additionalValue: number;
  details: string;
  total: number;
  amountPaid: number;
  remaining: number;
  source: 'agenda' | 'orcamento';
  clientId?: string;
  origin?: string;
  month: number; // 0-11
  year: number;
  parsedDate: Date;
}

export interface SalesDataSource {
  getSessions(filters?: Partial<SalesFilters>): Promise<SalesSession[]>;
  getAvailableYears(): Promise<number[]>;
  getAvailableCategories(): Promise<string[]>;
}

export interface SalesRepository {
  getAnalytics(filters: SalesFilters): Promise<SalesAnalyticsResult>;
}