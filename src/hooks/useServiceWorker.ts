import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useServiceWorker() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    // Verificar se service workers são suportados
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Workers não suportados neste navegador');
      return;
    }

    console.log('🔧 Iniciando registro do Service Worker...');

    // Registrar o service worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        console.log('✅ Service Worker registrado:', registration.scope);

        // Verificar se há atualização ao registrar (com tratamento de erro)
        try {
          await registration.update();
        } catch (updateError: any) {
          // ✅ CORREÇÃO: Detectar "behind a redirect" e forçar atualização total
          if (updateError?.message?.includes('redirect')) {
            console.warn('⚠️ SW update falhou (behind redirect), forçando atualização completa...');
            await forceUnregisterAndReload();
            return;
          }
        }

        // Listener para detectar novo service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          if (newWorker) {
            console.log('🔄 Nova versão do Service Worker encontrada');
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('✅ Nova versão instalada, ativando atualização...');
                setWaitingWorker(newWorker);
                setShowReload(true);
                
                toast.info('Nova versão disponível! Atualizando...', {
                  duration: 2000,
                });
                
                setTimeout(() => {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }, 2000);
              }
            });
          }
        });

        // Verificar se já existe um waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowReload(true);
          
          setTimeout(() => {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
          }, 1000);
        }

        // Verificar atualizações a cada 60 segundos
        setInterval(() => {
          registration.update();
        }, 60000);

      } catch (error) {
        console.error('Erro ao registrar Service Worker:', error);
      }
    };

    registerServiceWorker();

    // Listener para quando o service worker assume controle
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('🔄 Service Worker atualizado, recarregando página...');
      window.location.reload();
    });

    // Limpar cache antigo se app foi desinstalado
    const checkAndClearOldCache = async () => {
      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) {
        const sessionKey = 'pwa_session_check';
        const hadSession = sessionStorage.getItem(sessionKey);
        
        if (!hadSession) {
          // Primeira vez nesta sessão, pode ser reinstalação
          console.log('Nova sessão detectada, verificando cache...');
          sessionStorage.setItem(sessionKey, 'true');
        }
      }
    };

    checkAndClearOldCache();

    // ✅ Função para forçar atualização completa (desregistrar SW + limpar cache)
    async function forceUnregisterAndReload() {
      try {
        console.log('🔄 Forçando atualização completa do SW...');
        
        // Desregistrar todos os SWs
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
        console.log('✅ SWs desregistrados');
        
        // Limpar caches problemáticos
        const cacheNames = await caches.keys();
        const workboxCaches = cacheNames.filter(n => n.includes('workbox') || n.includes('vite'));
        await Promise.all(workboxCaches.map(n => caches.delete(n)));
        console.log('✅ Caches limpos:', workboxCaches.length);
        
        // Reload forçado
        window.location.reload();
      } catch (error) {
        console.error('❌ Erro ao forçar atualização:', error);
      }
    }

  }, []);

  const reloadPage = () => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
    setShowReload(false);
  };

  return {
    waitingWorker,
    showReload,
    reloadPage
  };
}
