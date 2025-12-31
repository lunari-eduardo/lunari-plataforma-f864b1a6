import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para sincronizar sessão entre abas do navegador.
 * Previne conflitos de refresh token quando múltiplas abas estão abertas.
 */
export const useSessionSync = () => {
  const { signOut } = useAuth();
  const broadcastChannel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Criar canal de broadcast para comunicação entre abas
    try {
      broadcastChannel.current = new BroadcastChannel('lunari-auth-sync');
      
      // Escutar mensagens de outras abas
      broadcastChannel.current.onmessage = async (event) => {
        const { type, timestamp } = event.data;
        
        if (type === 'SESSION_REFRESHED') {
          console.log('📡 Outra aba renovou sessão, revalidando...');
          // Pequeno delay para evitar race condition
          await new Promise(resolve => setTimeout(resolve, 100));
          await supabase.auth.getSession();
        }
        
        if (type === 'SIGNED_OUT') {
          console.log('📡 Outra aba fez logout, sincronizando...');
          signOut();
        }
      };
    } catch (e) {
      // BroadcastChannel não suportado (Safari < 15.4)
      console.log('BroadcastChannel não suportado, usando fallback localStorage');
    }

    // Fallback: escutar mudanças no localStorage (funciona em todos browsers)
    const handleStorageChange = async (e: StorageEvent) => {
      // Detectar mudanças nos tokens do Supabase
      if (e.key?.includes('sb-') && e.key.includes('auth-token')) {
        console.log('🔄 Token alterado em outra aba, verificando sessão...');
        
        // Pequeno delay para a outra aba terminar a operação
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('⚠️ Sessão perdida após mudança de token');
          // Não fazer logout automático aqui - deixar o AuthContext decidir
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      broadcastChannel.current?.close();
    };
  }, [signOut]);

  // Função para notificar outras abas sobre refresh
  const notifySessionRefresh = () => {
    try {
      broadcastChannel.current?.postMessage({
        type: 'SESSION_REFRESHED',
        timestamp: Date.now()
      });
    } catch (e) {
      // Ignorar erro se canal fechado
    }
  };

  // Função para notificar outras abas sobre logout
  const notifySignOut = () => {
    try {
      broadcastChannel.current?.postMessage({
        type: 'SIGNED_OUT',
        timestamp: Date.now()
      });
    } catch (e) {
      // Ignorar erro se canal fechado
    }
  };

  return { notifySessionRefresh, notifySignOut };
};
