import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SessionGaleria {
  id: string;
  tipo: string;
  status: string;
  status_pagamento: string | null;
  created_at: string;
}

/**
 * Hook para buscar todas as galerias vinculadas a uma sessão (por session_id texto)
 */
export function useSessionGalerias(sessionId: string | undefined) {
  const { user } = useAuth();
  const [galerias, setGalerias] = useState<SessionGaleria[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGalerias = useCallback(async () => {
    if (!user?.id || !sessionId) {
      setGalerias([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('galerias')
        .select('id, tipo, status, status_pagamento, created_at')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching session galerias:', error);
        setGalerias([]);
        return;
      }

      setGalerias((data || []) as SessionGaleria[]);
    } catch (err) {
      console.error('Exception fetching session galerias:', err);
      setGalerias([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, sessionId]);

  useEffect(() => {
    fetchGalerias();
  }, [fetchGalerias]);

  const hasGalerias = galerias.length > 0;

  return { galerias, loading, hasGalerias, refetch: fetchGalerias };
}
