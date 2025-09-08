import React from 'react';
import AuthLayout from '@/components/auth/AuthLayout';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout 
      title="Recuperar senha"
      subtitle="Enviaremos instruções para seu email"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}