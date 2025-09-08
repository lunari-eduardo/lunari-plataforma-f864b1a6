import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AuthLayout from '@/components/auth/AuthLayout';
import SignUpForm from '@/components/auth/SignUpForm';

export default function SignUpPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <AuthLayout title="Carregando...">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lunar-primary mx-auto"></div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Criar sua conta"
      subtitle="Comece a gerenciar sua carreira fotográfica"
    >
      <SignUpForm />
    </AuthLayout>
  );
}