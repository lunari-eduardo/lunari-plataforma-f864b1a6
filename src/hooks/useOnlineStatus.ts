import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  lastOnlineAt: Date | null;
  checkConnection: () => void;
}

export const useOnlineStatus = (): OnlineStatus => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(
    typeof navigator !== 'undefined' && navigator.onLine ? new Date() : null
  );

  const handleOnline = useCallback(() => {
    // Debounce para evitar flicker em reconexões rápidas
    setTimeout(() => {
      if (navigator.onLine) {
        setIsOnline(true);
        setLastOnlineAt(new Date());
      }
    }, 500);
  }, []);

  const handleOffline = useCallback(() => {
    // Delay curto para confirmar que está realmente offline
    setTimeout(() => {
      if (!navigator.onLine) {
        setIsOnline(false);
      }
    }, 1000);
  }, []);

  const checkConnection = useCallback(() => {
    setIsOnline(navigator.onLine);
    if (navigator.onLine) {
      setLastOnlineAt(new Date());
    }
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check inicial
    checkConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline, checkConnection]);

  return { isOnline, lastOnlineAt, checkConnection };
};
