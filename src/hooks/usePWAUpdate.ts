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
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Não registrar SW em rotas públicas (galerias, propostas, formulário, checkout, assinar)
    const isPublicRoute = /^\/(g|c|p|formulario|checkout|pay|l|assinar)\//.test(window.location.pathname);
    if (isPublicRoute) {
      navigator.serviceWorker.getRegistrations().then(regs =>
        regs.forEach(r => r.unregister())
      );
      caches.keys().then(names => names.forEach(n => caches.delete(n)));
      return;
    }

    console.log('🔧 [PWA] Iniciando registro via vite-plugin-pwa...');

    const updateSW = registerSW({
      onNeedRefresh() {
        console.log('🔄 [PWA] Nova versão detectada! Preparando atualização...');
        
        toast('Nova versão disponível!', {
          description: 'Clique aqui para atualizar',
          duration: 10000,
          action: {
            label: 'Atualizar',
            onClick: () => {
              console.log('🚀 [PWA] Aplicando atualização...');
              updateSW(true);
            }
          }
        });
      },
      
      onOfflineReady() {
        console.log('✅ [PWA] App pronto para uso offline');
      },
      
      onRegisteredSW(swUrl, registration) {
        console.log('✅ [PWA] Service Worker registrado:', swUrl);
        
        if (registration) {
          // 1. Polling periódico a cada 60 segundos enquanto ativo
          const intervalId = setInterval(() => {
            registration.update().catch((err) => {
              console.warn('⚠️ [PWA] Erro ao verificar atualizações:', err);
            });
          }, 60 * 1000);

          // 2. Verificação imediata assim que o app volta de segundo plano (celular desbloqueado)
          const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
              console.log('📱 [PWA] App voltou ao primeiro plano, verificando atualizações...');
              registration.update().catch((err) => {
                console.warn('⚠️ [PWA] Erro ao verificar atualizações pós-resumo:', err);
              });
            }
          };

          document.addEventListener('visibilitychange', handleVisibilityChange);
          window.addEventListener('focus', handleVisibilityChange);
        }
      },
      
      onRegisterError(error) {
        console.error('❌ [PWA] Erro ao registrar Service Worker:', error);
      },
    });
  }, []);
}
