import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAccessControl } from '@/hooks/useAccessControl';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { accessState, loading } = useAccessControl();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lunar-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lunar-accent"></div>
      </div>
    );
  }

  // Apenas usuários com isAdmin podem acessar
  if (!accessState.isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};
