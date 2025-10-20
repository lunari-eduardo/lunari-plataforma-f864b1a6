import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Detectar se já está instalado (ANTES da renderização)
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
      return;
    }

    // Verificar se foi desinstalado recentemente (nova sessão sem cache de instalação)
    const checkReinstallability = () => {
      const wasInstalled = sessionStorage.getItem('pwa_was_installed');
      if (wasInstalled === 'true') {
        // Foi desinstalado, limpar flag
        sessionStorage.removeItem('pwa_was_installed');
        console.log('App foi desinstalado, aguardando evento de instalação...');
      }
    };

    checkReinstallability();

    // 2. Capturar evento de instalação disponível
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
      console.log('Evento beforeinstallprompt capturado, app é instalável');
    };

    // 3. Detectar quando app foi instalado
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      sessionStorage.setItem('pwa_was_installed', 'true');
      console.log('App instalado com sucesso');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Verificar periodicamente se o evento pode ser disparado (fallback)
    // Isso ajuda em casos onde o evento não dispara imediatamente
    const checkInterval = setInterval(() => {
      if (!isInstallable && !installed && !deferredPrompt) {
        console.log('Verificando instalabilidade...');
      }
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
