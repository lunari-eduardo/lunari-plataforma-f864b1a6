/**
 * Sales Repository Implementation
 * Orchestrates data source and analytics calculations
 */

import { SalesRepository } from './sales-domain';
import { SalesDataSource } from './SalesDataSource';
import { 
  SalesFilters, 
  SalesAnalyticsResult, 
  SalesDomainMetrics,
  SalesMonthlyData,
  SalesCategoryData,
  SalesPackageData,
  SalesOriginData,
  SalesMonthlyOriginData,
  SalesSession,
  SalesComparisonResult
} from './sales-domain';
import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { computeComparison, ComparativeMonthlyDataPoint } from './comparisonUtils';

export class SalesRepositoryImpl implements SalesRepository {
  constructor(private dataSource: SalesDataSource) {}

  private log(message: string, ...args: any[]) {
    if (import.meta.env.VITE_DEBUG_SALES === 'true') {
      console.log(`📊 [SalesRepository] ${message}`, ...args);
    }
  }

  async getAnalytics(filters: SalesFilters): Promise<SalesAnalyticsResult> {
    this.log(`Getting analytics for year: ${filters.year}, month: ${filters.month}, category: ${filters.category}, comparisonYear: ${filters.comparisonYear ?? 'none'}`);
    
    const comparisonEnabled = filters.comparisonYear != null && filters.comparisonYear !== filters.year;

    const [sessions, availableYears, availableCategories, comparisonSessions] = await Promise.all([
      this.dataSource.getSessions(filters),
      this.dataSource.getAvailableYears(),
      this.dataSource.getAvailableCategories(),
      comparisonEnabled
        ? this.dataSource.getSessions({
            year: filters.comparisonYear!,
            month: filters.month,
            category: filters.category
          })
        : Promise.resolve([] as SalesSession[])
    ]);

    this.log(`Loaded ${sessions.length} filtered sessions${comparisonEnabled ? `, ${comparisonSessions.length} comparison sessions` : ''}`);

    let comparison: SalesComparisonResult | null = null;
    let baseSessionsForMetrics = sessions;

    if (comparisonEnabled) {
      // Resolve equivalent-period limit month
      const currentDate = new Date();
      const isCurrentYear = filters.year === currentDate.getFullYear();
      // Last month with data in the base year (0-11). -1 if no data
      const lastMonthWithData = sessions.reduce<number>(
        (max, s) => (s.year === filters.year && s.month > max ? s.month : max),
        -1
      );
      const autoLimit = isCurrentYear
        ? Math.min(currentDate.getMonth(), lastMonthWithData >= 0 ? lastMonthWithData : currentDate.getMonth())
        : (lastMonthWithData >= 0 ? lastMonthWithData : 11);

      const limitMonth = filters.comparisonLimitMonth != null
        ? Math.max(0, Math.min(11, filters.comparisonLimitMonth))
        : autoLimit;

      // When a specific month is selected, filter exactly that month; otherwise apply the limit
      const applyLimit = (list: SalesSession[]) =>
        filters.month != null
          ? list.filter(s => s.month === filters.month)
          : list.filter(s => s.month <= limitMonth);

      const baseLimited = applyLimit(sessions);
      const prevLimited = applyLimit(comparisonSessions);

      // Use limited base sessions for metrics so KPIs match the comparison period
      baseSessionsForMetrics = baseLimited;

      const baseMetricsLimited = await this.calculateMetrics(baseLimited, filters);
      const previousMetrics = await this.calculateMetrics(prevLimited, {
        ...filters,
        year: filters.comparisonYear!
      });
      const monthlyCurrentFull = await this.calculateMonthlyData(sessions, filters.year);
      const monthlyPreviousFull = await this.calculateMonthlyData(comparisonSessions, filters.comparisonYear!);

      // Truncate monthly series to limit (or single month) for comparative view
      const monthlyCurrent = filters.month != null
        ? monthlyCurrentFull.filter(m => m.monthIndex === filters.month)
        : monthlyCurrentFull.filter(m => m.monthIndex <= limitMonth);
      const monthlyPrevious = filters.month != null
        ? monthlyPreviousFull.filter(m => m.monthIndex === filters.month)
        : monthlyPreviousFull.filter(m => m.monthIndex <= limitMonth);

      const monthlyComparative: ComparativeMonthlyDataPoint[] = monthlyCurrent.map((cur, idx) => {
        const prev = monthlyPrevious[idx];
        return {
          month: cur.month,
          monthIndex: cur.monthIndex,
          revenueCurrent: cur.revenue,
          revenuePrevious: prev?.revenue ?? 0,
          sessionsCurrent: cur.sessions,
          sessionsPrevious: prev?.sessions ?? 0,
          averageTicketCurrent: cur.averageTicket,
          averageTicketPrevious: prev?.averageTicket ?? 0,
          extraPhotoRevenueCurrent: cur.extraPhotoRevenue,
          extraPhotoRevenuePrevious: prev?.extraPhotoRevenue ?? 0
        };
      });

      comparison = {
        baseYear: filters.year,
        comparisonYear: filters.comparisonYear!,
        previousMetrics,
        limitMonth: filters.month != null ? filters.month : limitMonth,
        metrics: {
          totalRevenue: computeComparison(baseMetricsLimited.totalRevenue, previousMetrics.totalRevenue),
          totalSessions: computeComparison(baseMetricsLimited.totalSessions, previousMetrics.totalSessions),
          averageTicket: computeComparison(baseMetricsLimited.averageTicket, previousMetrics.averageTicket),
          extraPhotosRevenue: computeComparison(
            baseMetricsLimited.extraPhotosRevenue ?? 0,
            previousMetrics.extraPhotosRevenue ?? 0
          ),
          expectedRevenue: computeComparison(
            baseMetricsLimited.expectedRevenue ?? 0,
            previousMetrics.expectedRevenue ?? 0
          )
        },
        monthlyData: monthlyComparative
      };
    }

    // KPI metrics: when comparison is active, reflect only the equivalent period
    const baseMetrics = comparisonEnabled
      ? await this.calculateMetrics(baseSessionsForMetrics, filters)
      : await this.calculateMetrics(sessions, filters);

    const result: SalesAnalyticsResult = {
      metrics: baseMetrics,
      monthlyData: await this.calculateMonthlyData(sessions, filters.year),
      categoryData: this.calculateCategoryData(sessions),
      packageData: this.calculatePackageData(sessions),
      originData: this.calculateOriginData(sessions),
      monthlyOriginData: await this.calculateMonthlyOriginData(filters.year, filters.category),
      availableYears,
      availableCategories,
      filteredDataCount: sessions.length,
      comparison
    };

    this.log('Analytics calculation completed');
    return result;
  }

  private async calculateMetrics(sessions: SalesSession[], filters: SalesFilters): Promise<SalesDomainMetrics> {
    const totalRevenue = sessions.reduce((sum, session) => sum + session.amountPaid, 0);
    const totalSessions = sessions.length;
    const averageTicket = totalSessions > 0 ? totalRevenue / totalSessions : 0;
    
    // Calculate extended metrics
    const extraPhotosRevenue = sessions.reduce((sum, session) => sum + session.totalExtraPhotoValue, 0);
    const additionalRevenue = sessions.reduce((sum, session) => sum + session.additionalValue, 0);
    const totalDiscount = sessions.reduce((sum, session) => sum + session.discount, 0);
    
    // Expected revenue (valor previsto = total das sessões)
    const expectedRevenue = sessions.reduce((sum, session) => sum + session.total, 0);
    const pendingRevenue = Math.max(0, expectedRevenue - totalRevenue);
    
    // Count unique clients
    const uniqueClients = new Set(
      sessions.map(session => session.clientEmail || session.clientPhone).filter(Boolean)
    ).size;

    // Get goal progress
    let monthlyGoalProgress = 0;
    try {
      const monthlyGoals = GoalsIntegrationService.getMonthlyGoals();
      const monthlyGoal = monthlyGoals.revenue;
      
      if (monthlyGoal > 0) {
        if (filters.month !== null) {
          // Specific month view
          monthlyGoalProgress = (totalRevenue / monthlyGoal) * 100;
        } else {
          // Yearly view - use current month
          const currentMonth = new Date().getMonth();
          const currentMonthRevenue = sessions
            .filter(session => session.month === currentMonth)
            .reduce((sum, session) => sum + session.amountPaid, 0);
          monthlyGoalProgress = (currentMonthRevenue / monthlyGoal) * 100;
        }
      }
    } catch (error) {
      console.warn('⚠️ [SalesRepository] Error loading monthly goals:', error);
    }

    // Get conversion rate from leads (we need to handle this differently since it's a hook)
    // For now, we'll use a default value and let the hook override it
    const conversionRate = 0; // Will be overridden by the hook

    this.log('📈 Métricas calculadas:', { 
      totalRevenue, 
      totalSessions, 
      averageTicket, 
      extraPhotosRevenue,
      additionalRevenue,
      totalDiscount,
      expectedRevenue,
      pendingRevenue
    });

    return {
      totalRevenue,
      totalSessions,
      averageTicket,
      newClients: uniqueClients,
      monthlyGoalProgress,
      conversionRate,
      extraPhotosRevenue,
      additionalRevenue,
      totalDiscount,
      expectedRevenue,
      pendingRevenue
    };
  }

  private async calculateMonthlyData(sessions: SalesSession[], year: number): Promise<SalesMonthlyData[]> {
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    // Get monthly goal
    let monthlyGoalAmount = 0;
    try {
      const monthlyGoals = GoalsIntegrationService.getMonthlyGoals();
      monthlyGoalAmount = monthlyGoals.revenue;
    } catch (error) {
      console.warn('⚠️ [SalesRepository] Error loading monthly goals:', error);
    }

    return months.map((month, index) => {
      const monthSessions = sessions.filter(session => 
        session.year === year && session.month === index
      );

      const revenue = monthSessions.reduce((sum, session) => sum + session.amountPaid, 0);
      const sessionCount = monthSessions.length;
      const averageTicket = sessionCount > 0 ? revenue / sessionCount : 0;
      const extraPhotoRevenue = monthSessions.reduce((sum, session) => sum + session.totalExtraPhotoValue, 0);

      return {
        month,
        monthIndex: index,
        revenue,
        sessions: sessionCount,
        averageTicket,
        extraPhotoRevenue,
        goal: monthlyGoalAmount
      };
    });
  }

  private calculateCategoryData(sessions: SalesSession[]): SalesCategoryData[] {
    const categoryStats = new Map<string, {
      sessions: number;
      revenue: number;
      totalExtraPhotos: number;
      packages: Map<string, number>;
    }>();

    sessions.forEach(session => {
      const category = session.category || 'Não categorizado';
      const current = categoryStats.get(category) || {
        sessions: 0,
        revenue: 0,
        totalExtraPhotos: 0,
        packages: new Map()
      };
      
      const packageName = session.package || 'Sem pacote';
      current.packages.set(packageName, (current.packages.get(packageName) || 0) + 1);
      
      categoryStats.set(category, {
        sessions: current.sessions + 1,
        revenue: current.revenue + session.amountPaid,
        totalExtraPhotos: current.totalExtraPhotos + session.extraPhotoCount,
        packages: current.packages
      });
    });

    const totalRevenue = Array.from(categoryStats.values())
      .reduce((sum, cat) => sum + cat.revenue, 0);

    return Array.from(categoryStats.entries()).map(([name, stats]) => {
      const packageValues = Array.from(stats.packages.values());
      const totalPackages = packageValues.reduce((sum, count) => sum + count, 0);
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
  }

  private calculatePackageData(sessions: SalesSession[]): SalesPackageData[] {
    const packageStats = new Map<string, { sessions: number; revenue: number }>();
    
    sessions.forEach(session => {
      const packageName = session.package || 'Sem pacote';
      const current = packageStats.get(packageName) || { sessions: 0, revenue: 0 };
      packageStats.set(packageName, {
        sessions: current.sessions + 1,
        revenue: current.revenue + session.amountPaid
      });
    });

    const totalSessions = sessions.length;
    return Array.from(packageStats.entries()).map(([name, stats]) => ({
      name,
      sessions: stats.sessions,
      revenue: stats.revenue,
      percentage: totalSessions > 0 ? (stats.sessions / totalSessions) * 100 : 0
    })).sort((a, b) => b.sessions - a.sessions);
  }

  private calculateOriginData(sessions: SalesSession[]): SalesOriginData[] {
    const originStats = new Map<string, { sessions: number; revenue: number }>();
    
    sessions.forEach(session => {
      const originKey = session.origin || 'nao-especificado';
      const current = originStats.get(originKey) || { sessions: 0, revenue: 0 };
      originStats.set(originKey, {
        sessions: current.sessions + 1,
        revenue: current.revenue + session.amountPaid
      });
    });

    const totalSessions = sessions.length;
    return Array.from(originStats.entries()).map(([originKey, stats]) => {
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
  }

  private async calculateMonthlyOriginData(year: number, category: string): Promise<SalesMonthlyOriginData[]> {
    // For now, we'll use the existing RevenueAnalyticsService
    // In the future, this will be replaced with repository-based logic
    try {
      const { revenueAnalyticsService } = await import('@/services/RevenueAnalyticsService');
      return revenueAnalyticsService.generateMonthlyOriginData(year, category);
    } catch (error) {
      console.error('❌ [SalesRepository] Error calculating monthly origin data:', error);
      return [];
    }
  }
}