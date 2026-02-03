import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getOAuthRedirectUri } from '@/utils/domainUtils';
import { PixManualData } from '@/components/integracoes/PixManualCard';

interface Integracao {
  id: string;
  user_id: string;
  provedor: string;
  mp_user_id: string | null;
  status: string;
  conectado_em: string | null;
  expira_em: string | null;
  dados_extras: Record<string, unknown>;
  is_default?: boolean;
}

export type ProvedorPagamento = 'mercadopago' | 'infinitepay' | 'pix_manual';
export type ProvedorPagamentoAtivo = ProvedorPagamento | null;

export interface MercadoPagoSettings {
  habilitarPix: boolean;
  habilitarCartao: boolean;
  maxParcelas: number;
}

interface UseIntegracoesReturn {
  integracoes: Integracao[];
  loading: boolean;
  connecting: boolean;
  
  // Mercado Pago
  mercadoPagoStatus: 'conectado' | 'desconectado' | 'pendente' | 'erro';
  mercadoPagoConnectedAt?: string;
  mercadoPagoUserId?: string;
  mercadoPagoSettings: MercadoPagoSettings | null;
  connectMercadoPago: () => void;
  disconnectMercadoPago: () => Promise<void>;
  handleOAuthCallback: (code: string) => Promise<boolean>;
  updateMercadoPagoSettings: (settings: Partial<MercadoPagoSettings>) => Promise<void>;
  
  // InfinitePay
  infinitePayStatus: 'conectado' | 'desconectado';
  infinitePayHandle: string | null;
  saveInfinitePayHandle: (handle: string) => Promise<void>;
  disconnectInfinitePay: () => Promise<void>;
  
  // PIX Manual
  pixManualStatus: 'conectado' | 'desconectado';
  pixManualData: PixManualData | null;
  savePixManual: (data: PixManualData) => Promise<void>;
  disconnectPixManual: () => Promise<void>;
  
  // Padrão e geral
  provedorAtivo: ProvedorPagamentoAtivo;
  provedorPadrao: ProvedorPagamento | null;
  setProvedorPadrao: (provedor: ProvedorPagamento) => Promise<void>;
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

  // ================== MERCADO PAGO ==================
  const mercadoPagoIntegration = integracoes.find(i => i.provedor === 'mercadopago');
  const mercadoPagoStatus = mercadoPagoIntegration?.status === 'ativo' 
    ? 'conectado' 
    : mercadoPagoIntegration?.status === 'pendente'
      ? 'pendente'
      : mercadoPagoIntegration?.status === 'erro'
        ? 'erro'
        : 'desconectado';
  const mercadoPagoConnectedAt = mercadoPagoIntegration?.conectado_em || undefined;
  const mercadoPagoUserId = mercadoPagoIntegration?.mp_user_id || undefined;
  
  // Mercado Pago Settings from dados_extras
  const mercadoPagoSettings: MercadoPagoSettings | null = mercadoPagoIntegration?.status === 'ativo'
    ? {
        habilitarPix: (mercadoPagoIntegration.dados_extras?.habilitarPix as boolean) !== false,
        habilitarCartao: (mercadoPagoIntegration.dados_extras?.habilitarCartao as boolean) !== false,
        maxParcelas: (mercadoPagoIntegration.dados_extras?.maxParcelas as number) || 12,
      }
    : null;

  // ================== INFINITEPAY ==================
  const infinitePayIntegration = integracoes.find(i => i.provedor === 'infinitepay');
  const infinitePayStatus: 'conectado' | 'desconectado' = 
    infinitePayIntegration?.status === 'ativo' ? 'conectado' : 'desconectado';
  const infinitePayHandle = (infinitePayIntegration?.dados_extras?.handle as string) || null;

  // ================== PIX MANUAL ==================
  const pixManualIntegration = integracoes.find(i => i.provedor === 'pix_manual');
  const pixManualStatus: 'conectado' | 'desconectado' = 
    pixManualIntegration?.status === 'ativo' ? 'conectado' : 'desconectado';
  const pixManualData: PixManualData | null = pixManualIntegration?.status === 'ativo' 
    ? {
        chavePix: (pixManualIntegration.dados_extras?.chavePix as string) || '',
        tipoChave: (pixManualIntegration.dados_extras?.tipoChave as PixManualData['tipoChave']) || 'cpf',
        nomeTitular: (pixManualIntegration.dados_extras?.nomeTitular as string) || '',
      }
    : null;

  // ================== PROVEDOR PADRÃO ==================
  const defaultIntegration = integracoes.find(i => 
    i.status === 'ativo' && 
    (i.is_default === true || (i.dados_extras?.is_default === true))
  );
  
  // Fallback: se nenhum tem is_default, pega o primeiro ativo
  const provedorPadrao: ProvedorPagamento | null = defaultIntegration 
    ? (defaultIntegration.provedor as ProvedorPagamento)
    : mercadoPagoStatus === 'conectado' 
      ? 'mercadopago' 
      : infinitePayStatus === 'conectado' 
        ? 'infinitepay'
        : pixManualStatus === 'conectado'
          ? 'pix_manual'
          : null;

  // Determine active payment provider (primeiro ativo)
  const provedorAtivo: ProvedorPagamentoAtivo = 
    mercadoPagoStatus === 'conectado' ? 'mercadopago' :
    infinitePayStatus === 'conectado' ? 'infinitepay' :
    pixManualStatus === 'conectado' ? 'pix_manual' : null;

  // ================== ACTIONS ==================

  const setProvedorPadrao = useCallback(async (provedor: ProvedorPagamento) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      // Remove is_default de todos
      const paymentProviders = ['mercadopago', 'infinitepay', 'pix_manual'];
      
      for (const p of paymentProviders) {
        const integration = integracoes.find(i => i.provedor === p);
        if (integration) {
          await supabase
            .from('usuarios_integracoes')
            .update({ 
              dados_extras: { 
                ...integration.dados_extras, 
                is_default: p === provedor 
              } 
            })
            .eq('user_id', user.id)
            .eq('provedor', p);
        }
      }

      toast.success(`${provedor === 'mercadopago' ? 'Mercado Pago' : provedor === 'infinitepay' ? 'InfinitePay' : 'PIX Manual'} definido como padrão`);
      await fetchIntegracoes();
    } catch (error) {
      console.error('[useIntegracoes] Set default error:', error);
      toast.error('Erro ao definir provedor padrão');
    }
  }, [user, integracoes, fetchIntegracoes]);

  const connectMercadoPago = useCallback(async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    setConnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-get-app-id');
      
      if (error || !data?.success || !data?.appId) {
        console.error('[useIntegracoes] Failed to get MP APP_ID:', error || data?.error);
        toast.error('Erro ao obter configuração do Mercado Pago');
        return;
      }

      const appId = data.appId;
      const redirectUri = getOAuthRedirectUri();
      const state = user.id;
      
      const authUrl = new URL(MP_AUTH_URL);
      authUrl.searchParams.set('client_id', appId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('platform_id', 'mp');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('redirect_uri', redirectUri);

      console.log('[useIntegracoes] Redirecting to MP OAuth:', authUrl.toString());
      window.location.href = authUrl.toString();
    } catch (err) {
      console.error('[useIntegracoes] Connect error:', err);
      toast.error('Erro ao conectar com Mercado Pago');
    } finally {
      setConnecting(false);
    }
  }, [user]);

  const handleOAuthCallback = useCallback(async (code: string): Promise<boolean> => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return false;
    }

    setConnecting(true);

    try {
      const redirectUri = getOAuthRedirectUri();
      
      const { data, error } = await supabase.functions.invoke('mercadopago-connect', {
        body: { code, redirectUri },
      });

      if (error) {
        console.error('[useIntegracoes] Connect error:', error);
        throw new Error(error.message || 'Erro ao conectar');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao conectar conta');
      }

      // Deactivate other providers when connecting MP
      await supabase
        .from('usuarios_integracoes')
        .update({ status: 'inativo' })
        .eq('user_id', user.id)
        .in('provedor', ['infinitepay', 'pix_manual']);

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

  // ================== MERCADO PAGO SETTINGS ==================

  const updateMercadoPagoSettings = useCallback(async (settings: Partial<MercadoPagoSettings>) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      const { data: existing, error: fetchError } = await supabase
        .from('usuarios_integracoes')
        .select('id, dados_extras')
        .eq('user_id', user.id)
        .eq('provedor', 'mercadopago')
        .single();

      if (fetchError || !existing) {
        throw new Error('Integração do Mercado Pago não encontrada');
      }

      const currentSettings = {
        habilitarPix: (existing.dados_extras as Record<string, unknown>)?.habilitarPix !== false,
        habilitarCartao: (existing.dados_extras as Record<string, unknown>)?.habilitarCartao !== false,
        maxParcelas: ((existing.dados_extras as Record<string, unknown>)?.maxParcelas as number) || 12,
      };

      const newSettings = { ...currentSettings, ...settings };

      const { error: updateError } = await supabase
        .from('usuarios_integracoes')
        .update({
          dados_extras: {
            ...(existing.dados_extras as Record<string, unknown>),
            habilitarPix: newSettings.habilitarPix,
            habilitarCartao: newSettings.habilitarCartao,
            maxParcelas: newSettings.maxParcelas,
          },
        })
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }

      toast.success('Configurações do Mercado Pago atualizadas');
      await fetchIntegracoes();

    } catch (error) {
      console.error('[useIntegracoes] Update MP settings error:', error);
      toast.error('Erro ao atualizar configurações');
    }
  }, [user, fetchIntegracoes]);

  // ================== INFINITEPAY ACTIONS ==================

  const saveInfinitePayHandle = useCallback(async (handle: string) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
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

  // ================== PIX MANUAL ACTIONS ==================

  const savePixManual = useCallback(async (data: PixManualData) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      const { error } = await supabase
        .from('usuarios_integracoes')
        .upsert({
          user_id: user.id,
          provedor: 'pix_manual',
          status: 'ativo',
          dados_extras: {
            chavePix: data.chavePix,
            tipoChave: data.tipoChave,
            nomeTitular: data.nomeTitular,
          },
          conectado_em: new Date().toISOString(),
        }, {
          onConflict: 'user_id,provedor',
        });

      if (error) {
        console.error('[useIntegracoes] Error saving PIX Manual:', error);
        throw error;
      }

      toast.success('PIX Manual configurado com sucesso!');
      await fetchIntegracoes();

    } catch (error) {
      console.error('[useIntegracoes] Save PIX Manual error:', error);
      toast.error('Erro ao salvar configuração PIX Manual');
    }
  }, [user, fetchIntegracoes]);

  const disconnectPixManual = useCallback(async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      const { error } = await supabase
        .from('usuarios_integracoes')
        .update({ status: 'inativo' })
        .eq('user_id', user.id)
        .eq('provedor', 'pix_manual');

      if (error) {
        console.error('[useIntegracoes] Error disconnecting PIX Manual:', error);
        throw error;
      }

      toast.success('PIX Manual removido');
      await fetchIntegracoes();

    } catch (error) {
      console.error('[useIntegracoes] Disconnect PIX Manual error:', error);
      toast.error('Erro ao remover PIX Manual');
    }
  }, [user, fetchIntegracoes]);

  return {
    integracoes,
    loading,
    connecting,
    
    // Mercado Pago
    mercadoPagoStatus,
    mercadoPagoConnectedAt,
    mercadoPagoUserId,
    mercadoPagoSettings,
    connectMercadoPago,
    disconnectMercadoPago,
    handleOAuthCallback,
    updateMercadoPagoSettings,
    
    // InfinitePay
    infinitePayStatus,
    infinitePayHandle,
    saveInfinitePayHandle,
    disconnectInfinitePay,
    
    // PIX Manual
    pixManualStatus,
    pixManualData,
    savePixManual,
    disconnectPixManual,
    
    // Padrão e geral
    provedorAtivo,
    provedorPadrao,
    setProvedorPadrao,
    refetch: fetchIntegracoes,
  };
}
