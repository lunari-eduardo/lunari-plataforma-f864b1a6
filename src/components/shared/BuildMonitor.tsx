import React, { useEffect } from 'react';
import { ProductionDebugger } from '@/utils/productionDebugger';

/**
 * Component to monitor production build health and provide debugging information
 */
export function BuildMonitor() {
  useEffect(() => {
    // Log build information for debugging
    console.log('🚀 [BuildMonitor] Lunari 2.0 iniciado');
    console.log('📦 [BuildMonitor] Versão:', import.meta.env.VITE_APP_VERSION || '1.0.0');
    console.log('🔧 [BuildMonitor] Modo:', import.meta.env.MODE);
    console.log('🌐 [BuildMonitor] Base URL:', import.meta.env.BASE_URL);
    
    // Check if we have a redirect from 404.html
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');
    if (redirectPath) {
      console.log('🔄 [BuildMonitor] Redirecionamento detectado:', redirectPath);
      // Remove the redirect parameter and navigate to the intended path
      const newUrl = window.location.origin + redirectPath;
      window.history.replaceState({}, '', newUrl);
    }
    
    // Monitor critical resources
    const checkResources = () => {
      try {
        // Check if React is loaded
        console.log('⚛️ [BuildMonitor] React versão:', React.version);
        
        // Check localStorage access
        const testKey = '__lunari_test__';
        localStorage.setItem(testKey, 'ok');
        localStorage.removeItem(testKey);
        console.log('💾 [BuildMonitor] LocalStorage funcionando');
        
        // Check if app data exists
        const hasWorkflow = !!localStorage.getItem('workflow_sessions');
        const hasClients = !!localStorage.getItem('lunari_clients');
        console.log('📊 [BuildMonitor] Dados do app:', { hasWorkflow, hasClients });
        
      } catch (error) {
        console.error('❌ [BuildMonitor] Erro na verificação de recursos:', error);
      }
    };
    
    // Run checks
    checkResources();
    
    // Use production debugger for comprehensive monitoring
    setTimeout(() => {
      ProductionDebugger.logDebugInfo();
      ProductionDebugger.checkCriticalResources();
    }, 1000);
    
  }, []);

  return null; // This is a monitoring component, no UI needed
}