/**
 * Centralized Error Handling Service  
 * Provides consistent error handling and logging across the application
 */

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  data?: any;
  timestamp: string;
}

export interface SystemError {
  id: string;
  message: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private errors: SystemError[] = [];
  private readonly MAX_ERRORS = 100;

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Handle and log errors consistently
   */
  handleError(
    error: Error | string,
    context: Omit<ErrorContext, 'timestamp'>,
    severity: SystemError['severity'] = 'medium'
  ): string {
    const errorId = this.generateErrorId();
    const message = error instanceof Error ? error.message : error;
    
    const systemError: SystemError = {
      id: errorId,
      message,
      context: {
        ...context,
        timestamp: new Date().toISOString()
      },
      severity,
      resolved: false
    };

    // Add to error list (keep only recent errors)
    this.errors.unshift(systemError);
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors = this.errors.slice(0, this.MAX_ERRORS);
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      const logMethod = this.getLogMethod(severity);
      logMethod(`[${severity.toUpperCase()}] ${context.operation}:`, message, context);
    }

    return errorId;
  }

  /**
   * Handle async operations with error catching
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: Omit<ErrorContext, 'timestamp'>,
    defaultValue?: T
  ): Promise<{ success: boolean; data?: T; errorId?: string }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      const errorId = this.handleError(error as Error, context, 'high');
      
      if (defaultValue !== undefined) {
        return { success: false, data: defaultValue, errorId };
      }
      
      return { success: false, errorId };
    }
  }

  /**
   * Handle sync operations with error catching
   */
  withSyncErrorHandling<T>(
    operation: () => T,
    context: Omit<ErrorContext, 'timestamp'>,
    defaultValue?: T
  ): { success: boolean; data?: T; errorId?: string } {
    try {
      const data = operation();
      return { success: true, data };
    } catch (error) {
      const errorId = this.handleError(error as Error, context, 'medium');
      
      if (defaultValue !== undefined) {
        return { success: false, data: defaultValue, errorId };
      }
      
      return { success: false, errorId };
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 20): SystemError[] {
    return this.errors.slice(0, limit);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: SystemError['severity']): SystemError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string): boolean {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Clear resolved errors
   */
  clearResolvedErrors(): number {
    const beforeCount = this.errors.length;
    this.errors = this.errors.filter(error => !error.resolved);
    return beforeCount - this.errors.length;
  }

  /**
   * Get error statistics
   */
  getStats(): {
    total: number;
    bySeverity: Record<SystemError['severity'], number>;
    resolved: number;
    unresolved: number;
  } {
    const bySeverity: Record<SystemError['severity'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    let resolved = 0;

    this.errors.forEach(error => {
      bySeverity[error.severity]++;
      if (error.resolved) resolved++;
    });

    return {
      total: this.errors.length,
      bySeverity,
      resolved,
      unresolved: this.errors.length - resolved
    };
  }

  /**
   * Export errors for analysis
   */
  exportErrors(): string {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      errors: this.errors,
      stats: this.getStats()
    }, null, 2);
  }

  // Private methods
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLogMethod(severity: SystemError['severity']): (...args: any[]) => void {
    switch (severity) {
      case 'critical':
      case 'high':
        return console.error;
      case 'medium':
        return console.warn;
      case 'low':
      default:
        return console.log;
    }
  }
}

// Export singleton instance
export const errorHandler = ErrorHandlingService.getInstance();
