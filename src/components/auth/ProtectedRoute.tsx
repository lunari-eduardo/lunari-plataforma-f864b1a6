import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DataMigrationRunner } from '@/components/migration/DataMigrationRunner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user needs data migration
  const hasLocalStorageData = localStorage.length > 0;
  
  if (hasLocalStorageData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <DataMigrationRunner />
      </div>
    );
  }

  return <>{children}</>;
};