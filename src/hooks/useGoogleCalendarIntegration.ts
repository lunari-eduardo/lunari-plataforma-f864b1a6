import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type GoogleCalendarStatus = 'conectado' | 'desconectado' | 'pendente' | 'erro';

interface GoogleCalendarIntegration {
  id: string;
  status: string;
  conectado_em: string | null;
  dados_extras: {
    calendar_id?: string;
    sync_enabled?: boolean;
  } | null;
}

interface UseGoogleCalendarReturn {
  status: GoogleCalendarStatus;
  loading: boolean;
  connecting: boolean;
  syncEnabled: boolean;
  connectedAt: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleSync: (enabled: boolean) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useGoogleCalendarIntegration(): UseGoogleCalendarReturn {
  const [integration, setIntegration] = useState<GoogleCalendarIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const fetchIntegration = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('usuarios_integracoes')
        .select('*')
        .eq('user_id', user.id)
        .eq('provedor', 'google_calendar')
        .maybeSingle();

      if (error) {
        console.error('[useGoogleCalendarIntegration] Fetch error:', error);
      }

      setIntegration(data as GoogleCalendarIntegration | null);
    } catch (error) {
      console.error('[useGoogleCalendarIntegration] Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegration();
  }, [fetchIntegration]);

  const status: GoogleCalendarStatus = (() => {
    if (!integration) return 'desconectado';
    if (integration.status === 'ativo') return 'conectado';
    if (integration.status === 'erro') return 'erro';
    return 'pendente';
  })();

  const syncEnabled = integration?.dados_extras?.sync_enabled !== false;
  const connectedAt = integration?.conectado_em || null;

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      // Use production URL for redirect
      const redirectUri = 'https://www.lunariplataforma.com.br/app/integracoes';

      const { data, error } = await supabase.functions.invoke('google-calendar-connect', {
        body: { redirectUri },
      });

      if (error) {
        console.error('[useGoogleCalendarIntegration] Connect error:', error);
        toast.error('Erro ao conectar com Google Calendar');
        return;
      }

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error('URL de autenticação não recebida');
      }
    } catch (error) {
      console.error('[useGoogleCalendarIntegration] Connect error:', error);
      toast.error('Erro ao conectar com Google Calendar');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setConnecting(true);
    try {
      const { error } = await supabase.functions.invoke('google-calendar-disconnect');

      if (error) {
        console.error('[useGoogleCalendarIntegration] Disconnect error:', error);
        toast.error('Erro ao desconectar do Google Calendar');
        return;
      }

      setIntegration(null);
      toast.success('Integração com Google Calendar desativada');
    } catch (error) {
      console.error('[useGoogleCalendarIntegration] Disconnect error:', error);
      toast.error('Erro ao desconectar do Google Calendar');
    } finally {
      setConnecting(false);
    }
  }, []);

  const toggleSync = useCallback(async (enabled: boolean) => {
    if (!integration) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newDadosExtras = {
        ...integration.dados_extras,
        sync_enabled: enabled,
      };

      const { error } = await supabase
        .from('usuarios_integracoes')
        .update({ dados_extras: newDadosExtras })
        .eq('user_id', user.id)
        .eq('provedor', 'google_calendar');

      if (error) {
        console.error('[useGoogleCalendarIntegration] Toggle sync error:', error);
        toast.error('Erro ao atualizar configuração');
        return;
      }

      setIntegration(prev => prev ? {
        ...prev,
        dados_extras: newDadosExtras,
      } : null);

      toast.success(enabled ? 'Sincronização ativada' : 'Sincronização desativada');
    } catch (error) {
      console.error('[useGoogleCalendarIntegration] Toggle sync error:', error);
      toast.error('Erro ao atualizar configuração');
    }
  }, [integration]);

  return {
    status,
    loading,
    connecting,
    syncEnabled,
    connectedAt,
    connect,
    disconnect,
    toggleSync,
    refetch: fetchIntegration,
  };
}
