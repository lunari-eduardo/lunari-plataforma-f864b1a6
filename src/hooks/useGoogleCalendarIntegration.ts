import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getOAuthRedirectUri } from '@/utils/domainUtils';

type GoogleCalendarStatus = 'conectado' | 'desconectado' | 'pendente' | 'erro';

interface GoogleCalendarIntegration {
  id: string;
  status: string;
  conectado_em: string | null;
  dados_extras: {
    calendar_id?: string;
    sync_enabled?: boolean;
    error?: string;
    error_at?: string;
  } | null;
}

interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  errors?: string[];
  needs_reconnect?: boolean;
}

interface PendingCount {
  count: number;
}

interface UseGoogleCalendarReturn {
  status: GoogleCalendarStatus;
  loading: boolean;
  connecting: boolean;
  syncing: boolean;
  syncEnabled: boolean;
  connectedAt: string | null;
  pendingCount: number;
  hasTokenError: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleSync: (enabled: boolean) => Promise<void>;
  syncExisting: () => Promise<SyncResult | null>;
  refetch: () => Promise<void>;
}

export function useGoogleCalendarIntegration(): UseGoogleCalendarReturn {
  const [integration, setIntegration] = useState<GoogleCalendarIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchIntegration = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch integration status
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

      // Fetch count of pending appointments
      if (data?.status === 'ativo') {
        const today = new Date().toISOString().split('T')[0];
        const { count } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'confirmado')
          .gte('date', today)
          .or('google_event_id.is.null,google_sync_status.eq.pending,google_sync_status.eq.error');
        
        setPendingCount(count || 0);
      }
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
  const hasTokenError = integration?.dados_extras?.error === 'token_revoked';

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      // Usar helper para suportar novos e antigos domínios
      const redirectUri = getOAuthRedirectUri();

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
      setPendingCount(0);
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

  const syncExisting = useCallback(async (): Promise<SyncResult | null> => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync-all');

      if (error) {
        console.error('[useGoogleCalendarIntegration] Sync existing error:', error);
        toast.error('Erro ao sincronizar agendamentos');
        return null;
      }

      // Check if reconnection is needed
      if (data?.needs_reconnect) {
        toast.error('Token expirado. Por favor, reconecte o Google Calendar.');
        await fetchIntegration(); // Refresh status
        return null;
      }

      // Refresh pending count after sync
      await fetchIntegration();

      return data as SyncResult;
    } catch (error) {
      console.error('[useGoogleCalendarIntegration] Sync existing error:', error);
      toast.error('Erro ao sincronizar agendamentos');
      return null;
    } finally {
      setSyncing(false);
    }
  }, [fetchIntegration]);

  return {
    status,
    loading,
    connecting,
    syncing,
    syncEnabled,
    connectedAt,
    pendingCount,
    hasTokenError,
    connect,
    disconnect,
    toggleSync,
    syncExisting,
    refetch: fetchIntegration,
  };
}
