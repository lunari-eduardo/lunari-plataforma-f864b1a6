import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineStatus } from './useOnlineStatus';

export interface AccessState {
  status: 'ok' | 'suspended' | 'no_subscription' | 'not_authenticated' | 'loading' | 'trial_expired' | 'network_error';
  reason?: string;
  isAdmin?: boolean;
  isVip?: boolean;
  isTrial?: boolean;
  isAuthorized?: boolean;
  daysRemaining?: number;
  trialEndsAt?: string;
  subscriptionId?: string;
  planId?: string;
  planCode?: string;
  planName?: string;
  currentPeriodEnd?: string;
  expiredAt?: string;
  cancelAtPeriodEnd?: boolean;
  hasGaleryAccess?: boolean;
  isOfflineCache?: boolean;
}

// Helper para detectar se é erro de rede
const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';
  
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('failed to fetch') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    code === 'pgrst301' || // Supabase network error
    error.name === 'TypeError' // fetch errors
  );
};

// Helper para delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useAccessControl = () => {
  const { user, loading: authLoading } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [accessState, setAccessState] = useState<AccessState>({ status: 'loading' });
  const [loading, setLoading] = useState(true);
  
  // Cache do último estado válido
  const lastValidState = useRef<AccessState | null>(null);

  const checkAccessWithRetry = useCallback(async (attempts = 3): Promise<AccessState> => {
    for (let i = 0; i < attempts; i++) {
      try {
        const { data, error } = await supabase.rpc('get_access_state');

        if (error) {
          console.error(`Access check attempt ${i + 1} failed:`, error);
          
          if (isNetworkError(error)) {
            // Se é erro de rede e temos cache válido, usar cache
            if (lastValidState.current?.status === 'ok') {
              console.log('Using cached access state due to network error');
              return { ...lastValidState.current, isOfflineCache: true };
            }
            
            // Tentar novamente com backoff exponencial
            if (i < attempts - 1) {
              const waitTime = Math.pow(2, i) * 1000; // 1s, 2s, 4s
              console.log(`Retrying in ${waitTime}ms...`);
              await delay(waitTime);
              continue;
            }
            
            // Esgotou tentativas - retornar network_error
            return { status: 'network_error', reason: 'Network error after retries' };
          }
          
          // Erro não é de rede - não tentar novamente
          return { status: 'no_subscription', reason: error.message || 'Error checking access' };
        }

        if (data) {
          const state = data as unknown as AccessState;
          // Salvar no cache se status é válido
          if (state.status === 'ok') {
            lastValidState.current = state;
          }
          return state;
        }

        return { status: 'no_subscription', reason: 'No data returned' };
      } catch (error: any) {
        console.error(`Access check exception attempt ${i + 1}:`, error);
        
        if (isNetworkError(error)) {
          // Usar cache se disponível
          if (lastValidState.current?.status === 'ok') {
            console.log('Using cached access state due to exception');
            return { ...lastValidState.current, isOfflineCache: true };
          }
          
          if (i < attempts - 1) {
            const waitTime = Math.pow(2, i) * 1000;
            await delay(waitTime);
            continue;
          }
          
          return { status: 'network_error', reason: 'Network exception after retries' };
        }
        
        return { status: 'no_subscription', reason: 'Exception checking access' };
      }
    }
    
    return { status: 'network_error', reason: 'Max retries exceeded' };
  }, []);

  const refetchAccess = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const state = await checkAccessWithRetry(3);
    setAccessState(state);
    setLoading(false);
  }, [user, checkAccessWithRetry]);

  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return;

      if (!user) {
        setAccessState({ status: 'not_authenticated' });
        setLoading(false);
        return;
      }

      // Se está offline, usar cache ou mostrar erro
      if (!isOnline) {
        if (lastValidState.current?.status === 'ok') {
          setAccessState({ ...lastValidState.current, isOfflineCache: true });
        } else {
          setAccessState({ status: 'network_error', reason: 'Device is offline' });
        }
        setLoading(false);
        return;
      }

      const state = await checkAccessWithRetry(3);
      setAccessState(state);
      setLoading(false);
    };

    checkAccess();
  }, [user, authLoading, isOnline, checkAccessWithRetry]);

  // Auto-retry quando voltar online
  useEffect(() => {
    if (isOnline && accessState.status === 'network_error') {
      console.log('Back online, retrying access check...');
      refetchAccess();
    }
  }, [isOnline, accessState.status, refetchAccess]);

  // Helper para verificar se usuário tem acesso PRO
  const hasPro = accessState.status === 'ok' && 
    (accessState.isAdmin || 
     accessState.isVip || 
     accessState.isAuthorized ||
     accessState.planCode?.startsWith('pro') ||
     accessState.isTrial);

  // Helper para verificar se usuário tem acesso à Galeria
  const hasGaleryAccess = accessState.status === 'ok' && 
    (accessState.hasGaleryAccess === true ||
     accessState.isAdmin ||
     accessState.isVip ||
     accessState.planCode?.startsWith('pro_galery'));

  return { accessState, loading, hasPro, hasGaleryAccess, refetchAccess };
};
