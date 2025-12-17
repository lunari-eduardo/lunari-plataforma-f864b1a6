import { useEffect } from 'react';
import { useAccessControl } from '@/hooks/useAccessControl';
import { toast } from '@/hooks/use-toast';

const TRIAL_WELCOME_KEY = 'trial_welcome_shown';

export const useTrialWelcomeToast = () => {
  const { accessState, loading } = useAccessControl();

  useEffect(() => {
    if (loading) return;
    
    // Only show for trial users
    if (accessState?.status !== 'ok' || !accessState?.isTrial) return;
    
    // Check if already shown
    const alreadyShown = localStorage.getItem(TRIAL_WELCOME_KEY);
    if (alreadyShown) return;
    
    // Show welcome toast
    toast({
      title: "🎉 Bem-vindo ao Lovable!",
      description: "Seu período de teste de 30 dias começou. Aproveite todos os recursos Pro!",
      duration: 8000,
    });
    
    // Mark as shown
    localStorage.setItem(TRIAL_WELCOME_KEY, 'true');
  }, [accessState, loading]);
};
