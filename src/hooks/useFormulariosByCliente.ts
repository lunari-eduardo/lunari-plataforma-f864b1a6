import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Formulario, FormularioCampo } from '@/types/formulario';

export function useFormulariosByCliente(clienteId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['formularios-cliente', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data, error } = await supabase
        .from('formularios')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(f => ({
        ...f,
        campos: (f.campos as unknown as FormularioCampo[]) || [],
      })) as Formulario[];
    },
    enabled: !!clienteId && !!user,
  });
}

export function useFormulariosBySession(sessionId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['formularios-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];

      const { data, error } = await supabase
        .from('formularios')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(f => ({
        ...f,
        campos: (f.campos as unknown as FormularioCampo[]) || [],
      })) as Formulario[];
    },
    enabled: !!sessionId && !!user,
  });
}
