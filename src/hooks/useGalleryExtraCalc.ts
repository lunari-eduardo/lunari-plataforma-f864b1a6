/**
 * Hook único que lê o snapshot canônico de "fotos extras" de uma galeria.
 *
 * Fonte: RPC `calculate_gallery_extra_payment(p_gallery_id)` no banco
 * compartilhado Gestão↔Gallery. Nunca calcular localmente
 * `(fotos_selecionadas − fotos_incluidas) × valor_foto_extra`.
 *
 * Usado por: WorkflowCardExpanded (bloco Adicionais), ExtraChargeModal,
 * ClienteDetalhe (galerias).
 *
 * Contrato do retorno (JSON da RPC):
 *  - success, valor_a_cobrar, valor_pago, valor_total_ideal
 *  - extras_necessarias, extras_pagas, extras_a_cobrar
 *  - valor_unitario, rules_source
 *  - is_fully_paid, selected_count, included_count
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GalleryExtraCalcSnapshot {
  success?: boolean;
  is_fully_paid?: boolean;
  valor_a_cobrar: number;
  valor_pago: number;
  valor_total_ideal: number;
  valor_unitario: number;
  extras_necessarias: number;
  extras_pagas: number;
  extras_a_cobrar: number;
  selected_count?: number;
  included_count?: number;
  rules_source?: string;
  error?: string;
}

const EMPTY: GalleryExtraCalcSnapshot = {
  success: true,
  is_fully_paid: true,
  valor_a_cobrar: 0,
  valor_pago: 0,
  valor_total_ideal: 0,
  valor_unitario: 0,
  extras_necessarias: 0,
  extras_pagas: 0,
  extras_a_cobrar: 0,
};

function toNum(v: unknown): number {
  return Number(v ?? 0) || 0;
}

function normalize(raw: unknown): GalleryExtraCalcSnapshot {
  const r = (raw ?? {}) as Record<string, unknown>;
  const valorAcobrar = toNum(r.valor_a_cobrar);
  return {
    success: r.success !== false,
    is_fully_paid: r.is_fully_paid === true || valorAcobrar <= 0,
    valor_a_cobrar: valorAcobrar,
    valor_pago: toNum(r.valor_pago),
    valor_total_ideal: toNum(r.valor_total_ideal),
    valor_unitario: toNum(r.valor_unitario),
    extras_necessarias: toNum(r.extras_necessarias),
    extras_pagas: toNum(r.extras_pagas),
    extras_a_cobrar: toNum(r.extras_a_cobrar),
    selected_count: r.selected_count != null ? toNum(r.selected_count) : undefined,
    included_count: r.included_count != null ? toNum(r.included_count) : undefined,
    rules_source: (r.rules_source as string) ?? undefined,
    error: (r.error as string) ?? undefined,
  };
}

export function useGalleryExtraCalc(galleryId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gallery-extra-calc', galleryId],
    enabled: !!galleryId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_gallery_extra_payment', {
        p_gallery_id: galleryId as string,
      });
      if (error) throw error;
      return normalize(data);
    },
  });

  // Realtime: invalida em UPDATE de galerias/cobrancas dessa galeria.
  useEffect(() => {
    if (!galleryId) return;
    const channel = supabase
      .channel(`gallery-sync-${galleryId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'galerias', filter: `id=eq.${galleryId}` },
        () => queryClient.invalidateQueries({ queryKey: ['gallery-extra-calc', galleryId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cobrancas', filter: `galeria_id=eq.${galleryId}` },
        () => queryClient.invalidateQueries({ queryKey: ['gallery-extra-calc', galleryId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [galleryId, queryClient]);

  return {
    calc: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: ['gallery-extra-calc', galleryId] }),
  };
}
