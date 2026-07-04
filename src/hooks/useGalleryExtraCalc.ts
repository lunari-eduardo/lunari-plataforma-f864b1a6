/**
 * Hook único que lê o snapshot canônico de "fotos extras" de uma galeria.
 *
 * Fonte: RPC `calculate_gallery_extra_payment(p_gallery_id)` no banco
 * compartilhado Gestão↔Gallery. Nunca calcular localmente
 * `(fotos_selecionadas − fotos_incluidas) × valor_foto_extra` — a RPC
 * aplica as faixas congeladas (desconto progressivo) e os pagamentos
 * já realizados.
 *
 * Usado por: WorkflowCardExpanded (bloco Adicionais), ExtraChargeModal,
 * ClienteDetalhe (galerias).
 *
 * Resolução da galeria:
 *  - Se `galleryId` for informado, usa direto.
 *  - Caso contrário, se `sessionId` (texto workflow-*) for informado,
 *    resolve a galeria por `galerias.session_id`. Prefere seleções com
 *    extras selecionadas; empate por created_at mais recente.
 */
import { useEffect, useState } from 'react';
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

interface UseGalleryExtraCalcOptions {
  /** Fallback: resolve galeria por `galerias.session_id` (texto workflow-*). */
  sessionId?: string | null;
}

export function useGalleryExtraCalc(
  galleryId: string | null | undefined,
  options: UseGalleryExtraCalcOptions = {},
) {
  const queryClient = useQueryClient();
  const { sessionId } = options;

  // Resolve galleryId a partir do sessionId quando não veio direto.
  const [resolvedGalleryId, setResolvedGalleryId] = useState<string | null>(
    galleryId ?? null,
  );

  useEffect(() => {
    if (galleryId) {
      setResolvedGalleryId(galleryId);
      return;
    }
    if (!sessionId) {
      setResolvedGalleryId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('galerias')
        .select(
          'id, tipo, fotos_selecionadas, fotos_incluidas, status_pagamento, created_at',
        )
        .eq('session_id', sessionId);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setResolvedGalleryId(null);
        return;
      }
      // Prioriza galerias com extras selecionadas; depois por created_at desc.
      const sorted = [...data].sort((a: any, b: any) => {
        const aExtras =
          Number(a.fotos_selecionadas ?? 0) - Number(a.fotos_incluidas ?? 0);
        const bExtras =
          Number(b.fotos_selecionadas ?? 0) - Number(b.fotos_incluidas ?? 0);
        const aHas = aExtras > 0 ? 1 : 0;
        const bHas = bExtras > 0 ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
      setResolvedGalleryId(sorted[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [galleryId, sessionId]);

  const query = useQuery({
    queryKey: ['gallery-extra-calc', resolvedGalleryId],
    enabled: !!resolvedGalleryId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_gallery_extra_payment', {
        p_gallery_id: resolvedGalleryId as string,
      });
      if (error) throw error;
      return normalize(data);
    },
  });

  // Realtime: invalida em UPDATE de galerias/cobrancas dessa galeria.
  useEffect(() => {
    if (!resolvedGalleryId) return;
    const channel = supabase
      .channel(`gallery-sync-${resolvedGalleryId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'galerias', filter: `id=eq.${resolvedGalleryId}` },
        () => queryClient.invalidateQueries({ queryKey: ['gallery-extra-calc', resolvedGalleryId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cobrancas', filter: `galeria_id=eq.${resolvedGalleryId}` },
        () => queryClient.invalidateQueries({ queryKey: ['gallery-extra-calc', resolvedGalleryId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedGalleryId, queryClient]);

  return {
    calc: query.data ?? EMPTY,
    resolvedGalleryId,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: ['gallery-extra-calc', resolvedGalleryId] }),
  };
}
