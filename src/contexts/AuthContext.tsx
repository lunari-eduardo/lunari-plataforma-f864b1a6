import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getAppBaseUrl } from '@/utils/domainUtils';
import { ensureFreshSession, forceRefreshSession } from '@/lib/auth/ensureFreshSession';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ data: any; error: any }>;
  signInWithEmail: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signUpWithEmail: (email: string, password: string, nome: string) => Promise<{ data: any; error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  updateEmail: (newEmail: string) => Promise<{ error: any }>;
  signOut: (scope?: 'local' | 'global' | 'others') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Marca que o boot inicial já decidiu sobre a sessão. Evita que
  // `onAuthStateChange` e `ensureFreshSession()` corram para zerar `loading`
  // em momentos distintos (race que liberava queries antes do refresh
  // terminar e gerava cascata de 401 + redirect indevido para /onboarding).
  const bootDoneRef = useRef(false);

  useEffect(() => {
    // 1) Listener — NÃO toca em `loading` enquanto o boot inicial não decidir.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        console.log('🔐 Auth event:', event, 'User:', nextSession?.user?.id || 'none');
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        if (bootDoneRef.current) {
          // Mantém `loading=false` após boot. Não voltamos a `true` em
          // TOKEN_REFRESHED para não esconder a UI durante refreshes normais.
          if (event === 'SIGNED_OUT') {
            console.log('👋 Usuário deslogado');
          }
        }
      }
    );

    // 2) Boot: garante UMA única chamada de refresh (singleton) caso o token
    //    esteja próximo de expirar. Só então libera a árvore.
    (async () => {
      try {
        const { session: fresh } = await ensureFreshSession();
        setSession(fresh);
        setUser(fresh?.user ?? null);
      } finally {
        bootDoneRef.current = true;
        setLoading(false);
      }
    })();

    return () => subscription.unsubscribe();
  }, []);

  // Refresh proativo - verificar token a cada minuto (usa o mesmo singleton,
  // não dispara refresh paralelo se outro já está em andamento).
  useEffect(() => {
    const checkTokenExpiry = async () => {
      if (!session?.expires_at) return;

      const expiresAt = session.expires_at * 1000;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiresAt - now < fiveMinutes && expiresAt > now) {
        console.log('⏰ Token expirando em breve, forçando refresh...');
        const { error } = await forceRefreshSession();
        if (error) {
          console.error('❌ Erro ao renovar sessão proativamente:', error);
        } else {
          console.log('✅ Sessão renovada proativamente');
        }
      }
    };

    checkTokenExpiry();
    const interval = setInterval(checkTokenExpiry, 60000);

    return () => clearInterval(interval);
  }, [session?.expires_at]);

  const signInWithGoogle = async () => {
    const siteUrl = getAppBaseUrl();
    
    console.log('🔑 Iniciando login com Google, redirect para:', `${siteUrl}/app`);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/app`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    return { data, error };
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log('🔑 Iniciando login com email:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('❌ Erro no login com email:', error.message);
    } else {
      console.log('✅ Login com email realizado com sucesso');
    }
    
    return { data, error };
  };

  const signUpWithEmail = async (email: string, password: string, nome: string) => {
    const siteUrl = getAppBaseUrl();
    
    console.log('📝 Iniciando cadastro com email:', email);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/app`,
        data: {
          nome: nome, // Disponível em user.user_metadata.nome
          full_name: nome,
        }
      }
    });
    
    if (error) {
      console.error('❌ Erro no cadastro:', error.message);
    } else {
      console.log('✅ Cadastro realizado, aguardando confirmação de email');
    }
    
    return { data, error };
  };

  const resetPassword = async (email: string) => {
    const siteUrl = getAppBaseUrl();
    
    console.log('🔄 Enviando email de recuperação de senha para:', email);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    
    if (error) {
      console.error('❌ Erro ao enviar email de recuperação:', error.message);
    } else {
      console.log('✅ Email de recuperação enviado');
    }
    
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    console.log('🔐 Atualizando senha...');
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) {
      console.error('❌ Erro ao atualizar senha:', error.message);
    } else {
      console.log('✅ Senha atualizada com sucesso');
    }
    
    return { error };
  };

  const updateEmail = async (newEmail: string) => {
    const siteUrl = getAppBaseUrl();
    
    console.log('📧 Solicitando alteração de email para:', newEmail);
    
    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    }, {
      emailRedirectTo: `${siteUrl}/app/minha-conta`,
    });
    
    if (error) {
      console.error('❌ Erro ao solicitar alteração de email:', error.message);
    } else {
      console.log('✅ Email de confirmação enviado para o novo endereço');
    }
    
    return { error };
  };

  const signOut = async (scope: 'local' | 'global' | 'others' = 'local') => {
    // 'local' (padrão): desloga apenas este dispositivo. Outros dispositivos
    // continuam autenticados. Use 'global' explicitamente para encerrar todas
    // as sessões (ex.: "Sair de todos os dispositivos").
    await supabase.auth.signOut({ scope });
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    updatePassword,
    updateEmail,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
