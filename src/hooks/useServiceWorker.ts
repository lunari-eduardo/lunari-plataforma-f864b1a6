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
          // ✅ CORREÇÃO: Detectar redirect loop ou erro "behind a redirect"
          const errorMessage = updateError?.message?.toLowerCase() || '';
          const isRedirectError = errorMessage.includes('redirect') || errorMessage.includes('behind');
          
          if (isRedirectError) {
            console.warn('🚨 [SW] Detectado redirect loop, executando limpeza AGRESSIVA...');
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

    // ✅ Função para forçar atualização AGRESSIVA completa
    async function forceUnregisterAndReload() {
      try {
        console.log('🔄 [SW] Forçando atualização AGRESSIVA completa...');
        
        // 1. Unregister TODOS os Service Workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(`🧹 [SW] Removendo ${registrations.length} service worker(s)...`);
        await Promise.all(registrations.map(registration => registration.unregister()));
        
        // 2. Limpar TODOS os caches (não apenas workbox)
        const cacheNames = await caches.keys();
        console.log(`🧹 [SW] Limpando ${cacheNames.length} cache(s)...`);
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        
        // 3. Limpar IndexedDB (workbox e vite)
        try {
          if ('databases' in indexedDB) {
            const dbs = await indexedDB.databases();
            dbs.forEach(db => {
              if (db.name && (db.name.includes('workbox') || db.name.includes('vite'))) {
                console.log(`🧹 [SW] Removendo IndexedDB: ${db.name}`);
                indexedDB.deleteDatabase(db.name);
              }
            });
          }
        } catch (idbError) {
          console.warn('⚠️ [SW] Não foi possível limpar IndexedDB:', idbError);
        }
        
        console.log('✅ [SW] Limpeza completa realizada, recarregando...');
        
        // 4. Hard reload (sem cache)
        window.location.reload();
      } catch (error) {
        console.error('❌ [SW] Erro ao forçar atualização:', error);
        // Fallback: simple reload
        window.location.reload();
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
