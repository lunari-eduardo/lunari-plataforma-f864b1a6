import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

/**
 * Hook para gerenciar atualizações automáticas do PWA.
 * Usa o mecanismo nativo do vite-plugin-pwa via virtual:pwa-register.
 * 
 * Funcionalidades:
 * - Detecta novas versões automaticamente via Service Worker
 * - Mostra toast informativo e recarrega após 2 segundos
 * - Polling a cada 60 segundos para verificar atualizações
 */
export function usePWAUpdate() {
  useEffect(() => {
    // Verificar se estamos em ambiente com suporte a SW
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('⚠️ [PWA] Service Workers não suportados');
      return;
    }

    console.log('🔧 [PWA] Iniciando registro via vite-plugin-pwa...');

    const updateSW = registerSW({
      immediate: true,
      
      onNeedRefresh() {
        console.log('🔄 [PWA] Nova versão detectada! Preparando atualização...');
        
        toast.info('Nova versão disponível! Atualizando em 2 segundos...', {
          duration: 2000,
        });
        
        // Aguardar 2 segundos e forçar atualização
        setTimeout(() => {
          console.log('🚀 [PWA] Aplicando atualização...');
          updateSW(true);
        }, 2000);
      },
      
      onOfflineReady() {
        console.log('✅ [PWA] App pronto para uso offline');
      },
      
      onRegisteredSW(swUrl, registration) {
        console.log('✅ [PWA] Service Worker registrado:', swUrl);
        
        // Verificar atualizações a cada 60 segundos
        if (registration) {
          const intervalId = setInterval(() => {
            console.log('🔍 [PWA] Verificando atualizações...');
            registration.update().catch((err) => {
              console.warn('⚠️ [PWA] Erro ao verificar atualizações:', err);
            });
          }, 60 * 1000);
          
          // Cleanup não é necessário aqui pois o hook roda uma vez
          // mas deixamos comentado caso precise no futuro
          // return () => clearInterval(intervalId);
        }
      },
      
      onRegisterError(error) {
        console.error('❌ [PWA] Erro ao registrar Service Worker:', error);
      },
    });
  }, []);
}
