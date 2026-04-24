import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AuditExtrasSuggestion {
  qtd: number;
  valor_unitario: number;
  valor_total: number;
  created_at: string;
}

export type DestinoSobra = 'adicional' | 'desconto_negativo' | 'manter_credito';

export interface ReconcileInput {
  sessionId: string;
  qtdExtras: number;
  valorUnitario: number;
  destinoSobra: DestinoSobra;
  valorSobra: number;
}

export function useReconcileExtras() {
  const [loading, setLoading] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  const fetchSuggestion = useCallback(async (galeriaId: string | undefined): Promise<AuditExtrasSuggestion | null> => {
    if (!galeriaId) return null;
    setSuggestionLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_audit_extras_suggestion', {
        p_galeria_id: galeriaId,
      });
      if (error) {
        console.error('[useReconcileExtras] Erro ao buscar sugestão:', error);
        return null;
      }
      return (data as unknown as AuditExtrasSuggestion) || null;
    } finally {
      setSuggestionLoading(false);
    }
  }, []);

  const reconcile = useCallback(async (input: ReconcileInput): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('reconcile_session_extras', {
        p_session_id: input.sessionId,
        p_qtd_extras: input.qtdExtras,
        p_valor_unitario: input.valorUnitario,
        p_destino_sobra: input.destinoSobra,
        p_valor_sobra: input.valorSobra,
      });

      if (error) {
        console.error('[useReconcileExtras] Erro ao reconciliar:', error);
        toast.error(error.message || 'Erro ao reconciliar crédito');
        return false;
      }

      toast.success('Crédito reconciliado com sucesso');
      return true;
    } catch (e: any) {
      console.error('[useReconcileExtras] Exceção:', e);
      toast.error(e?.message || 'Erro ao reconciliar crédito');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    suggestionLoading,
    fetchSuggestion,
    reconcile,
  };
}
