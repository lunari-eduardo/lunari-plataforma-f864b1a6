import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ data: any; error: any }>;
  signOut: () => Promise<void>;
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

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth event:', event, 'User:', session?.user?.id || 'none');
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Tratar eventos específicos
        if (event === 'TOKEN_REFRESHED') {
          console.log('✅ Token renovado automaticamente');
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('👋 Usuário deslogado');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Refresh proativo - verificar token a cada minuto
  useEffect(() => {
    const checkTokenExpiry = async () => {
      if (!session?.expires_at) return;
      
      const expiresAt = session.expires_at * 1000; // converter para ms
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      // Se falta menos de 5 minutos para expirar, forçar refresh
      if (expiresAt - now < fiveMinutes && expiresAt > now) {
        console.log('⏰ Token expirando em breve, forçando refresh...');
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('❌ Erro ao renovar sessão proativamente:', error);
        } else {
          console.log('✅ Sessão renovada proativamente');
        }
      }
    };
    
    // Verificar imediatamente e depois a cada minuto
    checkTokenExpiry();
    const interval = setInterval(checkTokenExpiry, 60000);
    
    return () => clearInterval(interval);
  }, [session?.expires_at]);

  const signInWithGoogle = async () => {
    // Usar domínio fixo para produção, garantindo redirect correto
    const isProduction = window.location.hostname.includes('lunariplataforma');
    const siteUrl = isProduction 
      ? 'https://www.lunariplataforma.com.br'
      : window.location.origin;
    
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};