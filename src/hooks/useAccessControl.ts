import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AccessState {
  status: 'ok' | 'suspended' | 'no_subscription' | 'not_authenticated' | 'loading' | 'trial_expired';
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
}

export const useAccessControl = () => {
  const { user, loading: authLoading } = useAuth();
  const [accessState, setAccessState] = useState<AccessState>({ status: 'loading' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return;

      if (!user) {
        setAccessState({ status: 'not_authenticated' });
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('get_access_state');

        if (error) {
          console.error('Error checking access:', error);
          setAccessState({ 
            status: 'no_subscription', 
            reason: 'Error checking access' 
          });
        } else if (data) {
          // Cast seguro: data é um JSONB do Postgres
          const state = data as unknown as AccessState;
          setAccessState(state);
        } else {
          setAccessState({ 
            status: 'no_subscription', 
            reason: 'No data returned' 
          });
        }
      } catch (error) {
        console.error('Exception checking access:', error);
        setAccessState({ 
          status: 'no_subscription', 
          reason: 'Exception checking access' 
        });
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, authLoading]);

  // Helper para verificar se usuário tem acesso PRO
  const hasPro = accessState.status === 'ok' && 
    (accessState.isAdmin || 
     accessState.isVip || 
     accessState.isAuthorized ||
     accessState.planCode?.startsWith('pro') ||
     accessState.isTrial);

  return { accessState, loading, hasPro };
};
