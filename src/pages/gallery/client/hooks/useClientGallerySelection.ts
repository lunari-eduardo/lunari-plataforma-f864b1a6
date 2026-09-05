import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInHours, isPast } from 'date-fns';
import { toast } from 'sonner';
import { Gallery, GalleryPhoto } from '@/types/gallery';
import { FilterMode } from '@/components/ClientGalleryHeader';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
import { SUPABASE_URL } from '../types';

interface UseClientGallerySelectionProps {
  identifier?: string;
  galleryId: string | null | undefined;
  visitorId: string | null;
  photos: GalleryPhoto[];
  gallery: Gallery | null;
  supabaseGallery: any;
  sessionRegras: any;
  isConfirmed: boolean;
}

export function useClientGallerySelection({
  identifier,
  galleryId,
  visitorId,
  photos,
  gallery,
  supabaseGallery,
  sessionRegras,
  isConfirmed,
}: UseClientGallerySelectionProps) {
  const queryClient = useQueryClient();
  const [localPhotos, setLocalPhotos] = useState<GalleryPhoto[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderViewMode, setFolderViewMode] = useState<'albums' | 'grid'>('albums');

  // Sync photos state when data loads
  useEffect(() => {
    if (photos.length > 0) {
      setLocalPhotos(prev => {
        if (prev.length === 0 || prev.length !== photos.length) {
          return photos;
        }
        const localById = new Map(prev.map(p => [p.id, p]));
        return photos.map(serverPhoto => {
          const localPhoto = localById.get(serverPhoto.id);
          return localPhoto ? {
            ...serverPhoto,
            isSelected: localPhoto.isSelected,
            isFavorite: localPhoto.isFavorite,
            comment: localPhoto.comment,
          } : serverPhoto;
        });
      });
    }
  }, [photos]);

  // Deadline checks
  const hasDeadline = !!supabaseGallery?.prazo_selecao;
  const hoursUntilDeadline = hasDeadline && gallery?.settings?.deadline
    ? differenceInHours(gallery.settings.deadline, new Date())
    : 999;
  const isNearDeadline = hasDeadline && hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;
  const isExpired = hasDeadline && !!gallery?.settings?.deadline && isPast(gallery.settings.deadline);
  const isBlocked = isExpired || isConfirmed;

  // Pricing rules
  const regrasCongeladas = 
    (supabaseGallery?.regrasCongeladas as unknown as RegrasCongeladas | null)
    || (sessionRegras?.regras_congeladas as unknown as RegrasCongeladas | null) 
    || (supabaseGallery?.regras_congeladas as unknown as RegrasCongeladas | null);

  const selectedCount = localPhotos.filter(p => p.isSelected).length;
  
  const chargeType = gallery?.saleSettings?.chargeType || 'only_extras';
  const extrasNecessarias = chargeType === 'all_selected'
    ? selectedCount
    : Math.max(0, selectedCount - (gallery?.includedPhotos ?? 0));
  
  const extrasPagasTotal = supabaseGallery?.extrasPagasTotal || supabaseGallery?.total_fotos_extras_vendidas || 0;
  const extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);
  const extraCount = extrasNecessarias;
  const valorJaPago = supabaseGallery?.valorTotalVendido || supabaseGallery?.valor_total_vendido || 0;
  
  const { 
    valorUnitario, 
    valorACobrar: extraTotal, 
    valorTotalIdeal,
    economia,
    totalExtras: totalExtrasAcumuladas 
  } = calcularPrecoProgressivoComCredito(
    extrasACobrar,
    extrasPagasTotal,
    valorJaPago,
    regrasCongeladas,
    gallery?.extraPhotoPrice || 0
  );

  // Selection mutation
  const selectionMutation = useMutation({
    mutationFn: async ({ photoId, action, comment, previousState }: { 
      photoId: string; 
      action: 'toggle' | 'select' | 'deselect' | 'comment' | 'favorite'; 
      comment?: string;
      previousState?: { isSelected: boolean; isFavorite: boolean; comment: string | null };
    }) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/client-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryToken: identifier, photoId, action, comment, visitorId: visitorId || undefined }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar seleção');
      }
      
      return response.json();
    },
    retry: 2,
    onSuccess: (data) => {
      setLocalPhotos(prev => prev.map(p => 
        p.id === data.photo.id 
          ? { 
              ...p, 
              isSelected: data.photo.is_selected, 
              isFavorite: data.photo.is_favorite ?? p.isFavorite,
              comment: data.photo.comment || p.comment 
            } 
          : p
      ));
      
      queryClient.setQueryData(['client-gallery-photos', galleryId], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map((p) => 
          p.id === data.photo.id 
            ? { 
                ...p, 
                is_selected: data.photo.is_selected,
                is_favorite: data.photo.is_favorite ?? p.is_favorite,
                comment: data.photo.comment ?? p.comment,
              } 
            : p
        );
      });
    },
    onError: (error: Error, variables) => {
      toast.error(error.message);
      if (variables.previousState) {
        setLocalPhotos(prev => prev.map(p =>
          p.id === variables.photoId
            ? { ...p, isSelected: variables.previousState!.isSelected, isFavorite: variables.previousState!.isFavorite, comment: variables.previousState!.comment }
            : p
        ));
      } else {
        queryClient.invalidateQueries({ queryKey: ['client-gallery-photos', galleryId] });
      }
    },
  });

  const toggleSelection = (photoId: string) => {
    if (isBlocked) return;
    
    const photo = localPhotos.find(p => p.id === photoId);
    if (photo) {
      const previousState = { isSelected: photo.isSelected, isFavorite: photo.isFavorite, comment: photo.comment };
      setLocalPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, isSelected: !p.isSelected } : p
      ));
      selectionMutation.mutate({ photoId, action: 'toggle', previousState });
    }
  };

  const handleComment = (photoId: string, comment: string) => {
    const photo = localPhotos.find(p => p.id === photoId);
    const previousState = photo ? { isSelected: photo.isSelected, isFavorite: photo.isFavorite, comment: photo.comment } : undefined;
    setLocalPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, comment } : p
    ));
    selectionMutation.mutate({ photoId, action: 'comment', comment, previousState });
  };

  const handleFavorite = (photoId: string) => {
    const photo = localPhotos.find(p => p.id === photoId);
    const previousState = photo ? { isSelected: photo.isSelected, isFavorite: photo.isFavorite, comment: photo.comment } : undefined;
    setLocalPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, isFavorite: !p.isFavorite } : p
    ));
    selectionMutation.mutate({ photoId, action: 'favorite', previousState });
  };

  // Compute filtered photos for grid
  const displayPhotos = useMemo(() => {
    let base = localPhotos;
    if (activeFolderId) {
      base = base.filter(p => p.folderId === activeFolderId);
    }
    if (filterMode === 'favorites') return base.filter(p => p.isFavorite);
    if (filterMode === 'selected') return base.filter(p => p.isSelected);
    return base;
  }, [localPhotos, activeFolderId, filterMode]);

  return {
    localPhotos,
    setLocalPhotos,
    filterMode,
    setFilterMode,
    activeFolderId,
    setActiveFolderId,
    folderViewMode,
    setFolderViewMode,
    displayPhotos,
    hasDeadline,
    hoursUntilDeadline,
    isNearDeadline,
    isExpired,
    isBlocked,
    regrasCongeladas,
    selectedCount,
    extrasNecessarias,
    extrasPagasTotal,
    extrasACobrar,
    extraCount,
    valorJaPago,
    valorUnitario,
    extraTotal,
    valorTotalIdeal,
    economia,
    totalExtrasAcumuladas,
    toggleSelection,
    handleComment,
    handleFavorite,
    isMutatingSelection: selectionMutation.isPending,
  };
}
