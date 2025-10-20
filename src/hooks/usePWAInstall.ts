import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [checkCount, setCheckCount] = useState(0);

  useEffect(() => {
    // 1. Detectar se já está instalado
    const checkIfInstalled = () => {
      // Chrome/Edge/Samsung Internet
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
      }
      
      // iOS Safari
      if ((navigator as any).standalone === true) {
        return true;
      }
      
      return false;
    };

    const installed = checkIfInstalled();
    setIsInstalled(installed);

    // Se já está instalado, não precisa mostrar botão
    if (installed) {
      setIsInstallable(false);
      console.log('✅ App já está instalado (display-mode: standalone)');
      return;
    }

    console.log('🔍 Iniciando detecção de instalabilidade do PWA...');

    // Limpar caches antigos se necessário
    const clearOldCaches = async () => {
      try {
        const cacheNames = await caches.keys();
        console.log('📦 Caches encontrados:', cacheNames.length);
        
        // Verificar se estamos em uma nova sessão após desinstalação
        const wasInstalled = sessionStorage.getItem('pwa_was_installed');
        if (wasInstalled === 'true' && !installed) {
          console.log('🔄 App foi desinstalado, limpando estado...');
          sessionStorage.removeItem('pwa_was_installed');
          
          // Limpar todos os caches para forçar estado limpo
          for (const cacheName of cacheNames) {
            await caches.delete(cacheName);
            console.log('🗑️ Cache removido:', cacheName);
          }
        }
      } catch (error) {
        console.error('Erro ao limpar caches:', error);
      }
    };

    clearOldCaches();

    // 2. Capturar evento de instalação disponível
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
      console.log('✅ Evento beforeinstallprompt capturado - App é instalável!');
    };

    // 3. Detectar quando app foi instalado
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      sessionStorage.setItem('pwa_was_installed', 'true');
      console.log('✅ App instalado com sucesso!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Verificar periodicamente (máximo 12 tentativas = 1 minuto)
    const checkInterval = setInterval(() => {
      setCheckCount(prev => {
        const newCount = prev + 1;
        
        if (newCount <= 12) {
          if (!isInstallable && !installed && !deferredPrompt) {
            console.log(`⏳ Aguardando evento de instalação... (${newCount}/12)`);
          }
        } else {
          console.log('⚠️ Evento beforeinstallprompt não disparado. Pode haver cooldown do navegador.');
          clearInterval(checkInterval);
        }
        
        return newCount;
      });
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearInterval(checkInterval);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostrar prompt de instalação nativo
    await deferredPrompt.prompt();
    
    // Aguardar escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA instalado com sucesso');
    }
    
    // Limpar prompt usado
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return {
    isInstallable,
    isInstalled,
    handleInstallClick
  };
}
