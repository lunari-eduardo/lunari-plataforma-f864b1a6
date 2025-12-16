import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Card } from '@/components/ui/card';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Routes that are allowed even without an active subscription
const SUBSCRIPTION_EXEMPT_ROUTES = [
  '/escolher-plano',
  '/minha-assinatura',
  '/minha-conta', // Needed for post-checkout sync
];

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { accessState, loading: accessLoading } = useAccessControl();
  const location = useLocation();

  // 1. Verificar autenticação
  if (authLoading || profileLoading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lunar-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lunar-accent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 2. Verificar controle de acesso (assinatura)
  if (accessState.status === 'suspended') {
    signOut();
    return <Navigate to="/auth?reason=suspended" replace />;
  }

  // 3. Verificar trial expirado - redirecionar para escolher plano
  if (accessState.status === 'trial_expired') {
    // Permitir acesso às páginas isentas
    if (SUBSCRIPTION_EXEMPT_ROUTES.includes(location.pathname)) {
      return <>{children}</>;
    }
    return <Navigate to="/escolher-plano" replace />;
  }

  // 4. Verificar sem subscription - permitir páginas de assinatura e conta
  if (accessState.status === 'no_subscription') {
    // Permitir acesso às páginas isentas (inclui /minha-conta para sync pós-checkout)
    if (SUBSCRIPTION_EXEMPT_ROUTES.includes(location.pathname)) {
      return <>{children}</>;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-lunar-bg p-4">
        <Card className="max-w-md w-full p-6 bg-black/20 border-white/10">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">Acesso Restrito</h2>
            <p className="text-white/80">
              Sua conta não possui uma assinatura ativa.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.href = '/escolher-plano'}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg transition-colors"
              >
                Escolher Plano
              </button>
              <button
                onClick={() => signOut()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // 5. Verificar onboarding (exceto se já estiver na rota /onboarding)
  if (location.pathname !== '/onboarding') {
    const needsOnboarding = !profile || 
      !profile.is_onboarding_complete || 
      !profile.nome?.trim() || 
      !profile.nicho?.trim() ||
      !profile.cidade_ibge_id;
      
    if (needsOnboarding) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
};
