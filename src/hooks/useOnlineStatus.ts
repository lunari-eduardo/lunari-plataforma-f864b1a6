import { useState, useEffect, useCallback, useRef } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  lastOnlineAt: Date | null;
  checkConnection: () => void;
  isInitializing: boolean;
}

/**
 * Hook otimizado para detectar status de conexão.
 * - Inicia sempre como "online" (otimista) para evitar flash de "sem conexão"
 * - Usa delay de 2s antes de confirmar offline (evita falsos positivos ao retomar PWA)
 * - Expõe isInitializing para componentes ignorarem estado durante boot
 */
export const useOnlineStatus = (): OnlineStatus => {
  // Sempre iniciar como online (otimista) para evitar flash
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(new Date());
  const offlineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOnline = useCallback(() => {
    // Cancelar qualquer timeout de offline pendente
    if (offlineTimeoutRef.current) {
      clearTimeout(offlineTimeoutRef.current);
      offlineTimeoutRef.current = null;
    }
    setIsOnline(true);
    setLastOnlineAt(new Date());
    setIsInitializing(false);
  }, []);

  const handleOffline = useCallback(() => {
    // Delay maior (2s) para confirmar que está realmente offline
    // Evita falsos positivos durante "wake up" do PWA
    if (offlineTimeoutRef.current) {
      clearTimeout(offlineTimeoutRef.current);
    }
    offlineTimeoutRef.current = setTimeout(() => {
      if (!navigator.onLine) {
        setIsOnline(false);
      }
      setIsInitializing(false);
    }, 2000);
  }, []);

  const checkConnection = useCallback(() => {
    if (navigator.onLine) {
      setIsOnline(true);
      setLastOnlineAt(new Date());
    }
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check inicial com delay para evitar flash
    const initTimeout = setTimeout(() => {
      checkConnection();
    }, 500);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(initTimeout);
      if (offlineTimeoutRef.current) {
        clearTimeout(offlineTimeoutRef.current);
      }
    };
  }, [handleOnline, handleOffline, checkConnection]);

  return { isOnline, lastOnlineAt, checkConnection, isInitializing };
};
