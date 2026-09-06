import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Gallery, GalleryPhoto, WatermarkSettings, DiscountPackage, TitleCaseMode } from '@/types/gallery';
import { getPhotoUrl, getOriginalPhotoUrl } from '@/lib/photoUrl';
import { sortPhotosByNaturalFilename } from '@/lib/photoOrdering';
import { isUUID, SUPABASE_URL, SUPABASE_ANON_KEY } from '../types';

interface UseClientGalleryDataProps {
  identifier?: string;
  sessionPassword: string | null;
  visitorId: string | null;
}

export function useClientGalleryData({
  identifier,
  sessionPassword,
  visitorId,
}: UseClientGalleryDataProps) {
  const isLegacyAccess = identifier ? isUUID(identifier) : false;

  // 1. Fetch gallery via Edge Function (handles token + password validation)
  const { 
    data: galleryResponse, 
    isLoading: isLoadingGallery, 
    error: galleryError, 
    refetch: refetchGallery 
  } = useQuery({
    queryKey: ['client-gallery', identifier, sessionPassword, visitorId],
    queryFn: async () => {
      if (!identifier) return null;
      
      // For legacy UUID access, use direct Supabase query
      if (isLegacyAccess) {
        const { data, error } = await supabase
          .from('galerias')
          .select('*')
          .eq('id', identifier)
          .single();
        
        if (error) throw new Error('Galeria não encontrada');
        return { success: true, gallery: data, photos: null, isLegacy: true };
      }
      
      // For token access, use Edge Function with pagination
      const fetchPage = async (page: number) => {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/gallery-access`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY 
          },
          body: JSON.stringify({ 
            token: identifier, 
            password: sessionPassword,
            page,
            limit: 200,
            visitorId: visitorId || undefined,
          }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          if (result.code === 'NOT_FOUND') throw new Error('Galeria não encontrada');
          if (result.code === 'WRONG_PASSWORD') throw new Error('Senha incorreta');
          if (result.code === 'NOT_AVAILABLE' && result.retryable) {
            throw new Error('GALLERY_PUBLISHING');
          }
          if (result.code === 'NOT_AVAILABLE') throw new Error('Galeria não disponível');
          if (result.code === 'INTERNAL_ERROR' || response.status >= 500) {
            throw new Error('GALLERY_SERVER_ERROR');
          }
          throw new Error(result.error || 'Erro ao acessar galeria');
        }
        
        return result;
      };

      // Fetch first page
      const firstPage = await fetchPage(1);
      
      // If there are more photos, fetch remaining pages in parallel
      if (firstPage.pagination?.hasMore) {
        const totalPages = Math.ceil(firstPage.pagination.total / firstPage.pagination.limit);
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 2))
        );
        // Merge all photos into first page result
        for (const page of remainingPages) {
          if (page.photos) {
            firstPage.photos.push(...page.photos);
          }
        }
      }
      
      return firstPage;
    },
    enabled: !!identifier,
    retry: (failureCount, error) => {
      if (error?.message === 'GALLERY_PUBLISHING' && failureCount < 3) return true;
      if (error?.message === 'GALLERY_SERVER_ERROR' && failureCount < 2) return true;
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Extract gallery data from response (handle both legacy and new format)
  const supabaseGallery = useMemo(() => {
    if (!galleryResponse) return null;
    if (galleryResponse.isLegacy) return galleryResponse.gallery;
    if (galleryResponse.success || galleryResponse.gallery || galleryResponse.sessionName) return galleryResponse.gallery;
    return null;
  }, [galleryResponse]);

  // Get gallery ID for queries
  const galleryId = supabaseGallery?.id || galleryResponse?.galleryId || (isLegacyAccess ? identifier : null);

  // Get session_id from gallery
  const sessionId = supabaseGallery?.sessionId || supabaseGallery?.session_id;

  // 2. Fetch frozen pricing rules from Gestão session
  const { data: sessionRegras } = useQuery({
    queryKey: ['client-gallery-session-rules', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      
      const { data, error } = await supabase
        .from('clientes_sessoes')
        .select('id, regras_congeladas, valor_foto_extra')
        .eq('session_id', sessionId)
        .single();
      
      if (error) {
        console.warn('Session rules fetch error:', error.message);
        return null;
      }
      
      return data;
    },
    enabled: !!sessionId && !supabaseGallery?.regrasCongeladas,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // 3. Fetch photos from Supabase (for legacy) or use from response (for token)
  const { data: supabasePhotos, isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['client-gallery-photos', galleryId],
    queryFn: async () => {
      if (!isLegacyAccess && galleryResponse?.photos) {
        return galleryResponse.photos;
      }
      
      if (!galleryId) return [];
      
      const { data, error } = await supabase
        .from('galeria_fotos')
        .select('*')
        .eq('galeria_id', galleryId)
        .order('original_filename', { ascending: true })
        .order('id', { ascending: true });
      
      if (error) {
        console.error('Photos fetch error:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!supabaseGallery,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // 4. Transform gallery data to local format
  const transformedGallery = useMemo((): Gallery | null => {
    if (!supabaseGallery) return null;
    
    const isEdgeFunctionFormat = 'sessionName' in supabaseGallery;
    
    const config = isEdgeFunctionFormat 
      ? (supabaseGallery.settings as Record<string, unknown> | null)
      : (supabaseGallery.configuracoes as Record<string, unknown> | null);
    const watermark = config?.watermark as WatermarkSettings | undefined;
    const watermarkDisplayRaw = config?.watermarkDisplay as string | undefined;
    const watermarkDisplay: 'all' | 'fullscreen' | 'none' = 
      watermarkDisplayRaw === 'fullscreen' || watermarkDisplayRaw === 'none' 
        ? watermarkDisplayRaw 
        : 'all';
    
    const deadlineRaw = isEdgeFunctionFormat ? supabaseGallery.deadline : supabaseGallery.prazo_selecao;
    const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
    
    return {
      id: supabaseGallery.id,
      clientName: (isEdgeFunctionFormat ? supabaseGallery.clientName : supabaseGallery.cliente_nome) || 'Cliente',
      clientEmail: (isEdgeFunctionFormat ? '' : supabaseGallery.cliente_email) || '',
      sessionName: (isEdgeFunctionFormat ? supabaseGallery.sessionName : supabaseGallery.nome_sessao) || 'Sessão de Fotos',
      packageName: (isEdgeFunctionFormat ? supabaseGallery.packageName : supabaseGallery.nome_pacote) || 'Pacote',
      includedPhotos: (isEdgeFunctionFormat ? supabaseGallery.includedPhotos : supabaseGallery.fotos_incluidas) ?? 0,
      extraPhotoPrice: (() => {
        const fromGallery = Number(isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra);
        if (fromGallery > 0) return fromGallery;

        const regras: any = isEdgeFunctionFormat
          ? (supabaseGallery as any).regrasCongeladas
          : (supabaseGallery as any).regras_congeladas;
        const fromRegras = Number(regras?.pacote?.valorFotoExtra ?? 0);
        if (fromRegras > 0) return fromRegras;

        return 0;
      })(),

      status: 'sent' as Gallery['status'],
      selectionStatus: (isEdgeFunctionFormat ? supabaseGallery.selectionStatus : supabaseGallery.status_selecao) === 'selecao_completa' ? 'confirmed' : 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
      saleSettings: (() => {
        if ((supabaseGallery as any).saleSettings) {
          return (supabaseGallery as any).saleSettings;
        }
        
        const explicitSettings = isEdgeFunctionFormat 
          ? (supabaseGallery.saleSettings as Record<string, unknown> | null)
          : null;
        const configSettings = config?.saleSettings as Record<string, unknown> | null;
        const rawSettings = explicitSettings || configSettings;

        const regras: any = isEdgeFunctionFormat
          ? (supabaseGallery as any).regrasCongeladas
          : (supabaseGallery as any).regras_congeladas;
        const precoExtraFromRegras = Number(regras?.pacote?.valorFotoExtra ?? 0);

        return {
          mode: (rawSettings?.mode as 'no_sale' | 'sale_with_payment' | 'sale_without_payment') || 'no_sale',
          pricingModel: (rawSettings?.pricingModel as 'fixed' | 'packages') || 'fixed',
          chargeType: (rawSettings?.chargeType as 'all_selected' | 'only_extras') || 'only_extras',
          fixedPrice: (rawSettings?.fixedPrice as number)
            || (precoExtraFromRegras > 0 ? precoExtraFromRegras : undefined)
            || (isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra)
            || 25,
          discountPackages: (rawSettings?.discountPackages as DiscountPackage[]) || [],
          paymentMethod: (rawSettings?.paymentMethod as 'pix_manual' | 'infinitepay' | 'mercadopago' | 'asaas' | undefined),
        };
      })(),
      settings: {
        welcomeMessage: (isEdgeFunctionFormat ? supabaseGallery.welcomeMessage : supabaseGallery.mensagem_boas_vindas) || '',
        deadline: deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        deadlinePreset: 7,
        watermark: watermark || { type: 'standard', opacity: 40, position: 'center' },
        watermarkDisplay,
        imageResizeOption: 1920,
        allowComments: config?.allowComments !== false,
        allowDownload: config?.allowDownload === true,
        allowExtraPhotos: true,
        sessionFont: config?.sessionFont as string | undefined,
        titleCaseMode: (config?.titleCaseMode as TitleCaseMode) || 'normal',
        photoSpacing: (isEdgeFunctionFormat ? supabaseGallery.settings?.photoSpacing : supabaseGallery.configuracoes?.photoSpacing) ?? (galleryResponse?.settings?.photoSpacing ?? 6),
      },
      photos: [],
      actions: [],
      selectedCount: 0,
      extraCount: 0,
      extraTotal: 0,
    };
  }, [supabaseGallery, galleryResponse]);

  // 5. Transform photos with direct static URLs from R2
  const photos = useMemo((): GalleryPhoto[] => {
    if (!supabasePhotos || !transformedGallery) return [];
    
    const mapped = supabasePhotos.map((photo: any) => {
      const photoWidth = photo.width || 800;
      const photoHeight = photo.height || 600;
      const storagePath = photo.storage_key;
      
      const photoPaths = {
        storageKey: storagePath,
        thumbPath: photo.thumb_path,
        previewPath: photo.preview_path,
        width: photoWidth,
        height: photoHeight,
      };
      
      return {
        id: photo.id,
        filename: photo.original_filename || photo.filename,
        originalFilename: photo.original_filename || photo.filename,
        thumbnailUrl: getPhotoUrl(photoPaths, 'thumbnail'),
        previewUrl: getPhotoUrl(photoPaths, 'preview'),
        originalUrl: getOriginalPhotoUrl(storagePath),
        storageKey: storagePath,
        originalPath: photo.original_path || null,
        width: photoWidth,
        height: photoHeight,
        isSelected: photo.is_selected || false,
        isFavorite: photo.is_favorite || false,
        comment: photo.comment || '',
        order: photo.order_index || 0,
        folderId: photo.pasta_id || null,
        coverUrl: photo.cover_path ? getPhotoUrl({ storageKey: photo.cover_path }, 'thumbnail') : null,
      };
    });

    return sortPhotosByNaturalFilename(mapped);
  }, [supabasePhotos, transformedGallery]);

  return {
    isLegacyAccess,
    galleryResponse,
    supabaseGallery,
    galleryId,
    sessionId,
    sessionRegras,
    transformedGallery,
    photos,
    isLoadingGallery,
    isLoadingPhotos,
    isLoading: isLoadingGallery || isLoadingPhotos,
    galleryError,
    refetchGallery,
  };
}
