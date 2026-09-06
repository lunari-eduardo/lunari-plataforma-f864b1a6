import { useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { useGalleryById } from '@/hooks/useGalleryById';
import { GalleryPhoto, GalleryAction, WatermarkSettings, Gallery } from '@/types/gallery';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
import { getEffectiveGalleryStatus } from '@/lib/galleryStatus';
import { getGalleryUrl } from '@/lib/galleryUrl';
import { PAYMENT_POLL_INTERVAL } from '../types';

interface UseGalleryDetailDataProps {
  id: string | undefined;
  defaultPhotoSpacing?: number;
}

export function useGalleryDetailData({
  id,
  defaultPhotoSpacing = 6,
}: UseGalleryDetailDataProps) {
  const queryClient = useQueryClient();

  const { 
    fetchGalleryPhotos, 
    sendGallery: sendSupabaseGallery,
    reopenSelection: reopenSupabaseSelection,
    deleteGallery: deleteSupabaseGallery,
    getPhotoUrl,
  } = useSupabaseGalleries({ enabled: false });

  const { data: supabaseGallery, isLoading: isGalleryLoading } = useGalleryById(id);

  // Resolve client ID (from gallery directly, or fallback to session/name search)
  const { data: resolvedClienteId } = useQuery({
    queryKey: ['gallery-resolved-client', supabaseGallery?.clienteId, supabaseGallery?.sessionId, supabaseGallery?.clienteNome],
    queryFn: async () => {
      if (supabaseGallery?.clienteId) return supabaseGallery.clienteId;

      if (supabaseGallery?.sessionId) {
        const { data: sess } = await supabase
          .from('clientes_sessoes')
          .select('cliente_id')
          .eq('session_id', supabaseGallery.sessionId)
          .maybeSingle();
        if (sess?.cliente_id) return sess.cliente_id;
      }

      if (supabaseGallery?.clienteNome) {
        const { data: client } = await supabase
          .from('clientes')
          .select('id')
          .ilike('nome', supabaseGallery.clienteNome.trim())
          .limit(1)
          .maybeSingle();
        if (client?.id) return client.id;
      }

      return null;
    },
    enabled: !!supabaseGallery,
  });

  const effectiveClienteId = supabaseGallery?.clienteId || resolvedClienteId;

  // Fetch photos (em paralelo com ID direto, fim do waterfall)
  const { data: supabasePhotos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['galeria-fotos', id],
    queryFn: () => fetchGalleryPhotos(id!),
    enabled: !!id,
  });

  // Fetch folders
  const { data: galleryFolders = [] } = useQuery({
    queryKey: ['galeria-pastas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('galeria_pastas')
        .select('*')
        .eq('galeria_id', id!)
        .order('ordem');
      if (error) {
        console.error('Error fetching folders:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch actions
  const { data: galleryActions = [] } = useQuery({
    queryKey: ['galeria-acoes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('galeria_acoes')
        .select('id, tipo, descricao, created_at')
        .eq('galeria_id', id!)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching gallery actions:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch ALL paid cobrancas
  const { data: cobrancasPagas = [], refetch: refetchCobrancas } = useQuery({
    queryKey: ['galeria-cobrancas-pagas', id],
    queryFn: async () => {
      if (!id) return [];
      
      const { data, error } = await supabase
        .from('cobrancas')
        .select('id, valor, qtd_fotos, provedor, metodo_manual, data_pagamento, ip_receipt_url, ip_checkout_url, status, created_at')
        .eq('galeria_id', id)
        .eq('finalidade', 'fotos_extras')
        .in('status', ['pago', 'pago_manual'])
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching paid charges:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch latest PENDING cobranca
  const { data: cobrancaData, refetch: refetchCobranca } = useQuery({
    queryKey: ['galeria-cobranca-pendente', id],
    queryFn: async () => {
      if (!id) return null;
      const PENDING_STATUSES = ['pendente', 'aguardando_confirmacao'];

      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('galeria_id', id)
        .eq('finalidade', 'fotos_extras')
        .in('status', PENDING_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching pending charge:', error);
        return null;
      }
      return data;
    },
    enabled: !!id,
  });

  // Check payment status via Edge Function
  const checkPaymentStatus = useCallback(async () => {
    if (!cobrancaData?.id) return;
    
    try {
      console.log('[Polling] Checking payment status for cobranca:', cobrancaData.id);
      
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { 
          cobrancaId: cobrancaData.id,
          forceUpdate: false 
        }
      });
      
      if (error) {
        console.error('[Polling] Error checking payment:', error);
        return;
      }
      
      if (data?.status === 'pago' && cobrancaData.status !== 'pago') {
        console.log('[Polling] Payment confirmed! Refreshing data...');
        queryClient.invalidateQueries({ queryKey: ['galleries'] });
        queryClient.invalidateQueries({ queryKey: ['gallery-by-id', id] });
        queryClient.invalidateQueries({ queryKey: ['galeria-cobranca-pendente', id] });
        queryClient.invalidateQueries({ queryKey: ['galeria-cobrancas-pagas', id] });
      }
    } catch (err) {
      console.error('[Polling] Error:', err);
    }
  }, [cobrancaData?.id, cobrancaData?.status, id, queryClient]);

  // Polling for pending payments
  useEffect(() => {
    const isPendingExternalPayment = 
      (cobrancaData?.status === 'pendente' || cobrancaData?.status === 'parcialmente_pago') && 
      (cobrancaData?.provedor === 'infinitepay' || cobrancaData?.provedor === 'mercadopago' || cobrancaData?.provedor === 'asaas');
    
    if (!isPendingExternalPayment) return;
    
    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, PAYMENT_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [cobrancaData?.status, cobrancaData?.provedor, checkPaymentStatus]);

  // Transform photos
  const transformedPhotos: GalleryPhoto[] = useMemo(() => {
    return supabasePhotos.map((photo: GaleriaPhoto, index: number) => ({
      id: photo.id,
      filename: photo.filename,
      originalFilename: photo.originalFilename || photo.filename,
      thumbnailUrl: getPhotoUrl(photo, supabaseGallery, 'thumbnail'),
      previewUrl: getPhotoUrl(photo, supabaseGallery, 'preview'),
      originalUrl: getPhotoUrl(photo, supabaseGallery, 'full'),
      width: photo.width,
      height: photo.height,
      isSelected: photo.isSelected,
      isFavorite: photo.isFavorite ?? false,
      comment: photo.comment || undefined,
      order: photo.orderIndex || index,
      folderId: photo.pastaId || null,
    }));
  }, [supabasePhotos, supabaseGallery, getPhotoUrl]);

  // Timeline actions
  const actions: GalleryAction[] = useMemo(() => {
    const typeMap: Record<string, GalleryAction['type']> = {
      'criada': 'created',
      'enviada': 'sent',
      'cliente_acessou': 'client_started',
      'cliente_confirmou': 'client_confirmed',
      'selecao_reaberta': 'selection_reopened',
      'pagamento_confirmado': 'payment_confirmed',
      'pagamento_informado': 'payment_informed',
      'selecao_iniciada': 'selection_started',
      'expirada': 'expired',
    };
    
    const relevantTypes = [
      'criada', 'enviada', 'cliente_acessou', 'cliente_confirmou', 
      'selecao_reaberta', 'pagamento_confirmado', 'pagamento_informado',
      'selecao_iniciada', 'expirada',
    ];
    
    return galleryActions
      .filter((action: { tipo: string }) => relevantTypes.includes(action.tipo))
      .map((action: { id: string; tipo: string; descricao: string | null; created_at: string }) => ({
        id: action.id,
        type: typeMap[action.tipo] || 'created',
        timestamp: new Date(action.created_at),
        description: action.descricao || action.tipo,
      }));
  }, [galleryActions]);

  const selectedPhotos = useMemo(() => transformedPhotos.filter(p => p.isSelected), [transformedPhotos]);
  const favoritePhotos = useMemo(() => selectedPhotos.filter(p => p.isFavorite), [selectedPhotos]);
  const photosWithComments = useMemo(() => selectedPhotos.filter(p => p.comment), [selectedPhotos]);

  const effectiveStatus = supabaseGallery ? getEffectiveGalleryStatus(
    supabaseGallery.status,
    supabaseGallery.statusPagamento,
    supabaseGallery.finalizedAt,
    supabaseGallery.statusSelecao,
    supabaseGallery.prazoSelecao
  ) : 'created';

  const canReactivate = effectiveStatus === 'expired' || effectiveStatus === 'selection_completed';

  const deadline = supabaseGallery ? (
    supabaseGallery.prazoSelecao || 
    new Date(supabaseGallery.createdAt.getTime() + (supabaseGallery.prazoSelecaoDias || 7) * 24 * 60 * 60 * 1000)
  ) : new Date();

  const clientLink = supabaseGallery?.publicToken
    ? getGalleryUrl(supabaseGallery.publicToken)
    : null;

  const regrasCongeladas = supabaseGallery?.regrasCongeladas as RegrasCongeladas | null;
  const extrasNecessarias = Math.max(0, (supabaseGallery?.fotosSelecionadas || 0) - (supabaseGallery?.fotosIncluidas || 0));
  const extrasPagasTotal = supabaseGallery?.totalFotosExtrasVendidas || 0;
  const valorJaPago = supabaseGallery?.valorTotalVendido || 0;
  const extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);
  
  const { valorUnitario, valorACobrar: calculatedExtraTotal, economia } = calcularPrecoProgressivoComCredito(
    extrasACobrar,
    extrasPagasTotal,
    valorJaPago,
    regrasCongeladas,
    supabaseGallery?.valorFotoExtra || 0
  );

  const watermark: WatermarkSettings = (supabaseGallery?.configuracoes?.watermark as WatermarkSettings) || {
    type: 'standard',
    opacity: 40,
    position: 'center',
  };

  const galleryForSummary: Gallery | null = supabaseGallery ? {
    id: supabaseGallery.id,
    clientName: supabaseGallery.clienteNome || 'Cliente',
    clientEmail: supabaseGallery.clienteEmail || '',
    sessionName: supabaseGallery.nomeSessao || 'Sessão',
    packageName: supabaseGallery.nomePacote || '',
    includedPhotos: supabaseGallery.fotosIncluidas,
    extraPhotoPrice: valorUnitario,
    saleSettings: (supabaseGallery.configuracoes?.saleSettings as Gallery['saleSettings']) || {
      mode: 'sale_without_payment',
      pricingModel: 'fixed',
      chargeType: 'only_extras',
      fixedPrice: supabaseGallery.valorFotoExtra,
      discountPackages: [],
    },
    status: effectiveStatus,
    selectionStatus: supabaseGallery.statusSelecao === 'selecao_completa' ? 'confirmed' : 'in_progress',
    settings: {
      welcomeMessage: supabaseGallery.mensagemBoasVindas || '',
      deadline,
      deadlinePreset: 'custom',
      watermark,
      watermarkDisplay: 'all',
      imageResizeOption: 1920,
      allowComments: supabaseGallery.configuracoes?.allowComments ?? true,
      allowDownload: supabaseGallery.configuracoes?.allowDownload ?? false,
      allowExtraPhotos: true,
      photoSpacing: supabaseGallery.configuracoes?.photoSpacing ?? defaultPhotoSpacing,
    },
    photos: transformedPhotos,
    actions,
    createdAt: supabaseGallery.createdAt,
    updatedAt: supabaseGallery.updatedAt,
    selectedCount: supabaseGallery.fotosSelecionadas,
    extraCount: extrasNecessarias,
    extraTotal: calculatedExtraTotal,
  } : null;

  return {
    supabaseGallery,
    effectiveClienteId,
    supabasePhotos,
    transformedPhotos,
    galleryFolders,
    galleryActions,
    actions,
    selectedPhotos,
    favoritePhotos,
    photosWithComments,
    cobrancasPagas,
    cobrancaData,
    effectiveStatus,
    canReactivate,
    deadline,
    clientLink,
    regrasCongeladas,
    extrasNecessarias,
    extrasPagasTotal,
    valorJaPago,
    extrasACobrar,
    valorUnitario,
    calculatedExtraTotal,
    economia,
    galleryForSummary,
    isLoadingData: isSupabaseLoading || isLoadingPhotos,
    refetchCobrancas,
    refetchCobranca,
    sendSupabaseGallery,
    reopenSupabaseSelection,
    deleteSupabaseGallery,
  };
}
