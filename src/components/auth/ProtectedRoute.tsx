import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const location = useLocation();

  // 1. Verificar autenticação
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lunar-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lunar-accent"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to auth page with return url
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 2. Verificar onboarding (exceto se já estiver na rota /onboarding)
  if (location.pathname !== '/onboarding') {
    const needsOnboarding = !profile || 
      !profile.is_onboarding_complete || 
      !profile.nome?.trim() || 
      !profile.cidade?.trim();
    
    // Debug temporário
    console.log('🔍 ProtectedRoute - Verificação de onboarding:', {
      hasProfile: !!profile,
      isComplete: profile?.is_onboarding_complete,
      hasNome: !!profile?.nome?.trim(),
      hasCidade: !!profile?.cidade?.trim(),
      needsOnboarding
    });
      
    if (needsOnboarding) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
};