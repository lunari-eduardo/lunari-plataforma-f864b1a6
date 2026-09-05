import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UploadedPhoto } from '@/components/PhotoUploader';

interface UseGalleryEditPhotosProps {
  galleryId?: string;
  gallery: any;
  fetchGalleryPhotos: (id: string) => Promise<any[]>;
  deletePhoto: (args: { photoId: string }) => Promise<any>;
  deletePhotos: (args: { photoIds: string[] }) => Promise<any>;
  isDeletingPhoto: boolean;
  isDeletingPhotos: boolean;
}

export function useGalleryEditPhotos({
  galleryId,
  gallery,
  fetchGalleryPhotos,
  deletePhoto,
  deletePhotos,
  isDeletingPhoto,
  isDeletingPhotos,
}: UseGalleryEditPhotosProps) {
  const queryClient = useQueryClient();
  const [localPhotoCount, setLocalPhotoCount] = useState<number | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);

  const { data: photos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['galeria-fotos', galleryId],
    queryFn: () => fetchGalleryPhotos(galleryId!),
    enabled: !!gallery && !!galleryId,
  });

  // Reset selection when switching folders
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeFolderId]);

  // Migrate orphan photos (pasta_id = null) to first folder
  useEffect(() => {
    if (!galleryId || !photos.length) return;
    const orphans = photos.filter((p) => !p.pastaId);
    if (orphans.length === 0) return;

    const migrateOrphans = async () => {
      const { data: existingFolders } = await supabase
        .from('galeria_pastas')
        .select('id')
        .eq('galeria_id', galleryId)
        .order('ordem')
        .limit(1);

      let targetFolderId = existingFolders?.[0]?.id;

      if (!targetFolderId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: newFolder } = await supabase
          .from('galeria_pastas')
          .insert({
            galeria_id: galleryId,
            user_id: user.id,
            nome: gallery?.nomeSessao || 'Todas as fotos',
            ordem: 0,
          })
          .select()
          .single();
        targetFolderId = newFolder?.id;
      }

      if (!targetFolderId) return;

      const orphanIds = orphans.map((p) => p.id);
      await supabase
        .from('galeria_fotos')
        .update({ pasta_id: targetFolderId })
        .in('id', orphanIds);

      queryClient.invalidateQueries({ queryKey: ['galeria-fotos', galleryId] });
      console.log(`📸 Migrated ${orphanIds.length} orphan photos to folder ${targetFolderId}`);
    };

    migrateOrphans();
  }, [galleryId, photos, gallery?.nomeSessao, queryClient]);

  const handleUploadComplete = (newPhotos: UploadedPhoto[]) => {
    setLocalPhotoCount((prev) => (prev || 0) + newPhotos.length);
    queryClient.invalidateQueries({ queryKey: ['galleries'] });
    queryClient.invalidateQueries({ queryKey: ['galerias'] });
    queryClient.invalidateQueries({ queryKey: ['galeria-fotos', galleryId] });
  };

  const handleDeletePhoto = async (photoId: string) => {
    await deletePhoto({ photoId } as any);
    setLocalPhotoCount((prev) => Math.max(0, (prev || 1) - 1));
    setSelectedIds((prev) => {
      if (!prev.has(photoId)) return prev;
      const next = new Set(prev);
      next.delete(photoId);
      return next;
    });
  };

  const toggleSelect = (photoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const toggleSelectAll = (visibleIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await deletePhotos({ photoIds: ids } as any);
      setLocalPhotoCount((prev) => Math.max(0, (prev || ids.length) - ids.length));
      toast.success(
        `${ids.length} foto${ids.length !== 1 ? 's' : ''} excluída${ids.length !== 1 ? 's' : ''}`
      );
      setSelectedIds(new Set());
      setConfirmBulkDeleteOpen(false);
    } catch (err) {
      // Erro mantido para permitir retry
    }
  };

  return {
    photos,
    isLoadingPhotos,
    localPhotoCount,
    setLocalPhotoCount,
    activeFolderId,
    setActiveFolderId,
    selectedIds,
    setSelectedIds,
    confirmBulkDeleteOpen,
    setConfirmBulkDeleteOpen,
    showPhotoUploader,
    setShowPhotoUploader,
    handleUploadComplete,
    handleDeletePhoto,
    toggleSelect,
    toggleSelectAll,
    handleBulkDelete,
    anyDeleting: isDeletingPhoto || isDeletingPhotos,
  };
}
