import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Integracao {
  id: string;
  user_id: string;
  provedor: string;
  mp_user_id: string | null;
  status: string;
  conectado_em: string | null;
  expira_em: string | null;
  dados_extras: Record<string, unknown>;
}

export type ProvedorPagamentoAtivo = 'mercadopago' | 'infinitepay' | null;

interface UseIntegracoesReturn {
  integracoes: Integracao[];
  loading: boolean;
  connecting: boolean;
  mercadoPagoStatus: 'conectado' | 'desconectado' | 'pendente' | 'erro';
  infinitePayStatus: 'conectado' | 'desconectado';
  infinitePayHandle: string | null;
  provedorAtivo: ProvedorPagamentoAtivo;
  connectMercadoPago: () => void;
  disconnectMercadoPago: () => Promise<void>;
  handleOAuthCallback: (code: string) => Promise<boolean>;
  saveInfinitePayHandle: (handle: string) => Promise<void>;
  disconnectInfinitePay: () => Promise<void>;
  refetch: () => Promise<void>;
}

// Mercado Pago OAuth configuration
const MP_AUTH_URL = 'https://auth.mercadopago.com.br/authorization';

export function useIntegracoes(): UseIntegracoesReturn {
  const { user } = useAuth();
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const fetchIntegracoes = useCallback(async () => {
    if (!user) {
      setIntegracoes([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('usuarios_integracoes')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('[useIntegracoes] Error fetching:', error);
        throw error;
      }

      // Type assertion since we know the structure
      setIntegracoes((data || []) as unknown as Integracao[]);
    } catch (error) {
      console.error('[useIntegracoes] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchIntegracoes();
  }, [fetchIntegracoes]);

  // Mercado Pago status
  const mercadoPagoIntegration = integracoes.find(i => i.provedor === 'mercadopago');
  const mercadoPagoStatus = mercadoPagoIntegration?.status === 'ativo' 
    ? 'conectado' 
    : mercadoPagoIntegration?.status === 'pendente'
      ? 'pendente'
      : mercadoPagoIntegration?.status === 'erro'
        ? 'erro'
        : 'desconectado';

  // InfinitePay status
  const infinitePayIntegration = integracoes.find(i => i.provedor === 'infinitepay');
  const infinitePayStatus: 'conectado' | 'desconectado' = 
    infinitePayIntegration?.status === 'ativo' ? 'conectado' : 'desconectado';
  const infinitePayHandle = (infinitePayIntegration?.dados_extras?.handle as string) || null;

  // Determine active payment provider
  const provedorAtivo: ProvedorPagamentoAtivo = 
    infinitePayStatus === 'conectado' ? 'infinitepay' :
    mercadoPagoStatus === 'conectado' ? 'mercadopago' : null;

  const connectMercadoPago = useCallback(() => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    // Get the APP_ID from environment - this needs to be set
    const appId = import.meta.env.VITE_MERCADOPAGO_APP_ID;
    
    if (!appId) {
      // Fallback: use a placeholder that will trigger configuration
      toast.error('Configure VITE_MERCADOPAGO_APP_ID no ambiente');
      return;
    }

    // Generate OAuth URL - callback vai para integracoes
    const redirectUri = 'https://www.lunariplataforma.com.br/app/integracoes';
    const state = user.id; // Use user ID as state to verify on callback
    
    const authUrl = new URL(MP_AUTH_URL);
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('platform_id', 'mp');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirectUri);

    console.log('[useIntegracoes] Redirecting to MP OAuth:', authUrl.toString());
    
    // Redirect to Mercado Pago
    window.location.href = authUrl.toString();
  }, [user]);

  const handleOAuthCallback = useCallback(async (code: string): Promise<boolean> => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return false;
    }

    setConnecting(true);

    try {
      const redirectUri = 'https://www.lunariplataforma.com.br/app/integracoes';
      
      console.log('[useIntegracoes] Exchanging code for token');
      
      const { data, error } = await supabase.functions.invoke('mercadopago-connect', {
        body: { 
          code,
          redirectUri,
        },
      });

      if (error) {
        console.error('[useIntegracoes] Connect error:', error);
        throw new Error(error.message || 'Erro ao conectar');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao conectar conta');
      }

      // Deactivate InfinitePay if connecting Mercado Pago
      await supabase
        .from('usuarios_integracoes')
        .update({ status: 'inativo' })
        .eq('user_id', user.id)
        .eq('provedor', 'infinitepay');

      toast.success('Conta Mercado Pago conectada com sucesso!');
      await fetchIntegracoes();
      return true;

    } catch (error) {
      console.error('[useIntegracoes] OAuth callback error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao conectar conta');
      return false;
    } finally {
      setConnecting(false);
    }
  }, [user, fetchIntegracoes]);

  const disconnectMercadoPago = useCallback(async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-disconnect', {});

      if (error) {
        console.error('[useIntegracoes] Disconnect error:', error);
        throw new Error(error.message || 'Erro ao desconectar');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao desconectar conta');
      }

      toast.success('Conta Mercado Pago desconectada');
      await fetchIntegracoes();

    } catch (error) {
      console.error('[useIntegracoes] Disconnect error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao desconectar conta');
    }
  }, [user, fetchIntegracoes]);

  // InfinitePay methods
  const saveInfinitePayHandle = useCallback(async (handle: string) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      // First, deactivate Mercado Pago if active
      await supabase
        .from('usuarios_integracoes')
        .update({ status: 'inativo' })
        .eq('user_id', user.id)
        .eq('provedor', 'mercadopago');

      // Upsert InfinitePay integration
      const { error } = await supabase
        .from('usuarios_integracoes')
        .upsert({
          user_id: user.id,
          provedor: 'infinitepay',
          status: 'ativo',
          dados_extras: { handle },
          conectado_em: new Date().toISOString(),
        }, {
          onConflict: 'user_id,provedor',
        });

      if (error) {
        console.error('[useIntegracoes] Error saving InfinitePay handle:', error);
        throw error;
      }

      toast.success('InfinitePay conectado com sucesso!');
      await fetchIntegracoes();

    } catch (error) {
      console.error('[useIntegracoes] Save InfinitePay error:', error);
      toast.error('Erro ao salvar configuração InfinitePay');
    }
  }, [user, fetchIntegracoes]);

  const disconnectInfinitePay = useCallback(async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      const { error } = await supabase
        .from('usuarios_integracoes')
        .update({ status: 'inativo' })
        .eq('user_id', user.id)
        .eq('provedor', 'infinitepay');

      if (error) {
        console.error('[useIntegracoes] Error disconnecting InfinitePay:', error);
        throw error;
      }

      toast.success('InfinitePay desconectado');
      await fetchIntegracoes();

    } catch (error) {
      console.error('[useIntegracoes] Disconnect InfinitePay error:', error);
      toast.error('Erro ao desconectar InfinitePay');
    }
  }, [user, fetchIntegracoes]);

  return {
    integracoes,
    loading,
    connecting,
    mercadoPagoStatus,
    infinitePayStatus,
    infinitePayHandle,
    provedorAtivo,
    connectMercadoPago,
    disconnectMercadoPago,
    handleOAuthCallback,
    saveInfinitePayHandle,
    disconnectInfinitePay,
    refetch: fetchIntegracoes,
  };
}
