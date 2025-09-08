import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthService } from '@/services/AuthService';
import { AuthContextType } from '@/types/auth';
import { toast } from '@/hooks/use-toast';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 [AuthContext] Auth state changed:', event, session);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔐 [AuthContext] Initial session check:', session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await AuthService.signIn(email, password);
      
      if (error) {
        toast({
          title: "Erro no login",
          description: error.message || "Credenciais inválidas",
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Login realizado",
        description: "Bem-vindo de volta!"
      });
      
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await AuthService.signUp(email, password);
      
      if (error) {
        toast({
          title: "Erro no cadastro",
          description: error.message || "Não foi possível criar a conta",
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Conta criada",
        description: "Verifique seu email para confirmar a conta"
      });
      
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await AuthService.signOut();
      
      if (error) {
        toast({
          title: "Erro no logout",
          description: error.message || "Não foi possível fazer logout",
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Logout realizado",
        description: "Até logo!"
      });
      
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    try {
      const { error } = await AuthService.resetPassword(email);
      
      if (error) {
        toast({
          title: "Erro ao enviar email",
          description: error.message || "Não foi possível enviar o email de recuperação",
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Email enviado",
        description: "Verifique sua caixa de entrada para redefinir a senha"
      });
      
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (password: string) => {
    setLoading(true);
    try {
      const { error } = await AuthService.updatePassword(password);
      
      if (error) {
        toast({
          title: "Erro ao atualizar senha",
          description: error.message || "Não foi possível atualizar a senha",
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Senha atualizada",
        description: "Sua senha foi alterada com sucesso"
      });
      
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}