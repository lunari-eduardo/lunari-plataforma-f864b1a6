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
  SalesSession
} from './sales-domain';
import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';
import { useLeadMetrics } from '@/hooks/useLeadMetrics';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';

export class SalesRepositoryImpl implements SalesRepository {
  constructor(private dataSource: SalesDataSource) {}

  private log(message: string, ...args: any[]) {
    if (import.meta.env.VITE_DEBUG_SALES === 'true') {
      console.log(`📊 [SalesRepository] ${message}`, ...args);
    }
  }

  async getAnalytics(filters: SalesFilters): Promise<SalesAnalyticsResult> {
    this.log(`Getting analytics for year: ${filters.year}, month: ${filters.month}, category: ${filters.category}`);
    
    const [sessions, availableYears, availableCategories] = await Promise.all([
      this.dataSource.getSessions(filters),
      this.dataSource.getAvailableYears(),
      this.dataSource.getAvailableCategories()
    ]);

    this.log(`Loaded ${sessions.length} filtered sessions`);

    const result: SalesAnalyticsResult = {
      metrics: await this.calculateMetrics(sessions, filters),
      monthlyData: await this.calculateMonthlyData(sessions, filters.year),
      categoryData: this.calculateCategoryData(sessions),
      packageData: this.calculatePackageData(sessions),
      originData: this.calculateOriginData(sessions),
      monthlyOriginData: await this.calculateMonthlyOriginData(filters.year, filters.category),
      availableYears,
      availableCategories,
      filteredDataCount: sessions.length
    };

    this.log('Analytics calculation completed');
    return result;
  }

  private async calculateMetrics(sessions: SalesSession[], filters: SalesFilters): Promise<SalesDomainMetrics> {
    const totalRevenue = sessions.reduce((sum, session) => sum + session.amountPaid, 0);
    const totalSessions = sessions.length;
    const averageTicket = totalSessions > 0 ? totalRevenue / totalSessions : 0;
    
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

    return {
      totalRevenue,
      totalSessions,
      averageTicket,
      newClients: uniqueClients,
      monthlyGoalProgress,
      conversionRate
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