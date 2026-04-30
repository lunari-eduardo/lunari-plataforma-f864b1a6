import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface AutentiqueAccount {
  id?: string;
  name?: string;
  email?: string;
}

export interface AutentiqueStatus {
  connected: boolean;
  account?: AutentiqueAccount | null;
  conectado_em?: string | null;
  valid?: boolean;
  validationError?: string;
}

const QK = ['integration', 'autentique'];

export function useAutentiqueIntegration() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const statusQuery = useQuery({
    queryKey: [...QK, user?.id],
    queryFn: async (): Promise<AutentiqueStatus> => {
      const { data, error } = await supabase.functions.invoke('autentique-status', {
        method: 'POST',
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error.message);
      return data as AutentiqueStatus;
    },
    enabled: !!user,
  });

  const connect = useMutation({
    mutationFn: async (apiKey: string) => {
      const { data, error } = await supabase.functions.invoke('autentique-connect', {
        body: { api_key: apiKey },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: any) =>
      toast({
        title: 'Não foi possível conectar',
        description: e?.message || 'Verifique sua API Key e tente novamente.',
        variant: 'destructive',
      }),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('autentique-disconnect', {
        method: 'POST',
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: any) =>
      toast({ title: 'Erro ao desconectar', description: e?.message, variant: 'destructive' }),
  });

  const test = useMutation({
    mutationFn: async (): Promise<AutentiqueStatus> => {
      const { data, error } = await supabase.functions.invoke('autentique-status?test=1', {
        method: 'POST',
      });
      if (error) throw error;
      return data as AutentiqueStatus;
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    refetch: statusQuery.refetch,
    connect: connect.mutateAsync,
    isConnecting: connect.isPending,
    disconnect: disconnect.mutateAsync,
    isDisconnecting: disconnect.isPending,
    test: test.mutateAsync,
    isTesting: test.isPending,
  };
}
