/**
 * Production Debugger Utility
 * Helps identify issues in production builds
 */

interface DebugInfo {
  appVersion: string;
  buildMode: string;
  baseUrl: string;
  userAgent: string;
  timestamp: string;
  performance: {
    loadTime: number;
    domContentLoaded: number;
  };
  localStorage: {
    available: boolean;
    hasWorkflowData: boolean;
    hasClientData: boolean;
    dataSize: number;
  };
  errors: any[];
}

class ProductionDebugger {
  private static errors: any[] = [];

  static init() {
    // Capture all errors
    window.addEventListener('error', (event) => {
      this.errors.push({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: new Date().toISOString()
      });
      console.error('🔥 [ProductionDebugger] JavaScript Error:', event);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.errors.push({
        type: 'promise',
        reason: event.reason,
        timestamp: new Date().toISOString()
      });
      console.error('🔥 [ProductionDebugger] Unhandled Promise Rejection:', event);
    });

    console.log('🔍 [ProductionDebugger] Inicializado');
  }

  static getDebugInfo(): DebugInfo {
    const performance = window.performance;
    const timing = performance?.timing;
    
    let loadTime = 0;
    let domContentLoaded = 0;
    
    if (timing) {
      loadTime = timing.loadEventEnd - timing.navigationStart;
      domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
    }

    // Check localStorage
    let localStorageInfo = {
      available: false,
      hasWorkflowData: false,
      hasClientData: false,
      dataSize: 0
    };

    try {
      localStorage.setItem('__test__', 'test');
      localStorage.removeItem('__test__');
      localStorageInfo.available = true;
      
      localStorageInfo.hasWorkflowData = !!localStorage.getItem('workflow_sessions');
      localStorageInfo.hasClientData = !!localStorage.getItem('lunari_clients');
      
      // Calculate approximate localStorage usage
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }
      localStorageInfo.dataSize = totalSize;
    } catch (e) {
      console.warn('❌ [ProductionDebugger] LocalStorage não disponível');
    }

    return {
      appVersion: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
      buildMode: (import.meta as any).env?.MODE || 'unknown',
      baseUrl: (import.meta as any).env?.BASE_URL || '/',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      performance: {
        loadTime,
        domContentLoaded
      },
      localStorage: localStorageInfo,
      errors: [...this.errors]
    };
  }

  static logDebugInfo() {
    const info = this.getDebugInfo();
    console.group('🔍 [ProductionDebugger] Debug Information');
    console.log('📱 App Version:', info.appVersion);
    console.log('🔧 Build Mode:', info.buildMode);
    console.log('🌐 Base URL:', info.baseUrl);
    console.log('⏱️ Load Time:', `${info.performance.loadTime}ms`);
    console.log('💾 LocalStorage:', info.localStorage);
    console.log('❌ Errors Count:', info.errors.length);
    if (info.errors.length > 0) {
      console.log('📋 Recent Errors:', info.errors.slice(-5));
    }
    console.groupEnd();
    return info;
  }

  static checkCriticalResources(): boolean {
    const issues: string[] = [];

    // Check if React is working (check for React DOM mount point)
    try {
      const rootElement = document.getElementById('root');
      if (!rootElement || !rootElement.hasChildNodes()) {
        issues.push('React DOM não renderizado');
      }
    } catch (e) {
      issues.push('Erro ao verificar React DOM');
    }

    // Check if routing is working
    if (!window.location.pathname) {
      issues.push('Roteamento não funcionando');
    }

    // Check CSS
    const styles = document.styleSheets;
    if (!styles || styles.length === 0) {
      issues.push('CSS não carregado');
    }

    if (issues.length > 0) {
      console.error('🚨 [ProductionDebugger] Problemas críticos encontrados:', issues);
      return false;
    }

    console.log('✅ [ProductionDebugger] Todos os recursos críticos OK');
    return true;
  }

  static exportDebugReport(): string {
    const info = this.getDebugInfo();
    return JSON.stringify(info, null, 2);
  }
}

// Auto-initialize in production
if (typeof window !== 'undefined') {
  ProductionDebugger.init();
}

export { ProductionDebugger };