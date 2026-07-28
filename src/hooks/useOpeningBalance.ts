/**
 * Saldo inicial do Fluxo de Caixa por ano.
 *
 * Cascata (implementada na RPC `finance_get_opening_balance`):
 *   1. valor manual do próprio ano;
 *   2. rollover automático dos até 3 anos anteriores;
 *   3. zero.
 *
 * Também expõe hooks para o banner de descoberta (persistido em
 * `user_preferences.configuracoes_financeiro.openingHintDismissedAt`) e para
 * as mutações de salvar/limpar override manual.
 */
import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserId } from './useCurrentUserId';

export type OpeningBalanceOrigin = 'manual' | 'auto_rollover' | 'zero';

export interface OpeningBalance {
  valor: number;
  origem: OpeningBalanceOrigin;
  anoBase: number;
}

const KEY = (userId: string | null, ano: number) => ['finance', 'opening-balance', userId, ano] as const;

export function useOpeningBalance(ano: number) {
  const userId = useCurrentUserId();
  return useQuery<OpeningBalance>({
    queryKey: KEY(userId, ano),
    enabled: !!userId && Number.isFinite(ano),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('finance_get_opening_balance' as any, { _ano: ano });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const valor = Number(row?.valor ?? 0);
      const origem = (row?.origem ?? 'zero') as OpeningBalanceOrigin;
      const anoBase = Number(row?.ano_base ?? ano - 1);
      return { valor, origem, anoBase };
    },
  });
}

export function useSetOpeningBalance() {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: async ({ ano, valor, observacoes }: { ano: number; valor: number; observacoes?: string }) => {
      const { data, error } = await supabase.rpc('finance_set_opening_balance' as any, {
        _ano: ano,
        _valor: valor,
        _observacoes: observacoes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['finance', 'opening-balance', userId] });
      qc.invalidateQueries({ queryKey: ['dashboard-financeiro'] });
      // invalida também anos posteriores (rollover cascade)
      for (let y = vars.ano; y <= vars.ano + 5; y++) {
        qc.invalidateQueries({ queryKey: KEY(userId, y) });
      }
    },
  });
}

export function useClearOpeningBalance() {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: async (ano: number) => {
      const { error } = await supabase.rpc('finance_clear_opening_balance' as any, { _ano: ano });
      if (error) throw error;
    },
    onSuccess: (_d, ano) => {
      for (let y = ano; y <= ano + 5; y++) {
        qc.invalidateQueries({ queryKey: KEY(userId, y) });
      }
      qc.invalidateQueries({ queryKey: ['dashboard-financeiro'] });
    },
  });
}

/**
 * Banner "Entendi" — persistência em `user_preferences.configuracoes_financeiro`.
 */
export function useOpeningHintDismissal() {
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const KEY_HINT = ['finance', 'opening-hint-dismissed', userId] as const;

  const query = useQuery<string | null>({
    queryKey: KEY_HINT,
    enabled: !!userId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('configuracoes_financeiro')
        .eq('user_id', userId!)
        .maybeSingle();
      const cfg = (data?.configuracoes_financeiro ?? {}) as Record<string, unknown>;
      return (cfg.openingHintDismissedAt as string | undefined) ?? null;
    },
  });

  const dismiss = useCallback(async () => {
    if (!userId) return;
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id, configuracoes_financeiro')
      .eq('user_id', userId)
      .maybeSingle();
    const cfg = (existing?.configuracoes_financeiro ?? {}) as Record<string, unknown>;
    const merged = { ...cfg, openingHintDismissedAt: new Date().toISOString() };
    if (existing?.id) {
      await supabase.from('user_preferences').update({ configuracoes_financeiro: merged }).eq('id', existing.id);
    } else {
      await supabase.from('user_preferences').insert({ user_id: userId, configuracoes_financeiro: merged });
    }
    qc.setQueryData(KEY_HINT, merged.openingHintDismissedAt);
  }, [userId, qc]);

  return { dismissedAt: query.data ?? null, isLoading: query.isLoading, dismiss };
}
