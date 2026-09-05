import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UploadedPhoto } from '@/components/PhotoUploader';

interface UseGalleryPhotosProps {
  supabaseGalleryId: string | null;
  user: any;
  deletePhoto: (args: { photoId: string }) => Promise<any>;
}

export function useGalleryPhotos({
  supabaseGalleryId,
  user,
  deletePhoto,
}: UseGalleryPhotosProps) {
  const queryClient = useQueryClient();
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [showUploadedPhotos, setShowUploadedPhotos] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [uploadErrorCount, setUploadErrorCount] = useState(0);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handlePhotoUploadComplete = (photos: UploadedPhoto[]) => {
    setUploadedPhotos((prev) => [...prev, ...photos]);
    setUploadedCount((prev) => prev + photos.length);
  };

  const handleDeleteUploadedPhoto = async (photoId: string) => {
    if (!supabaseGalleryId || deletingPhotoId) return;
    setDeletingPhotoId(photoId);
    try {
      await deletePhoto({ photoId });

      // Refund 1 credit via RPC (handles subscription vs purchased bucket)
      if (user) {
        await supabase.rpc('refund_photo_credit' as any, { _user_id: user.id });
        queryClient.invalidateQueries({ queryKey: ['photo-credits'] });
      }

      setUploadedPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setUploadedCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error deleting photo:', err);
      toast.error('Erro ao excluir foto');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const handleDeleteAllPhotos = async () => {
    if (!supabaseGalleryId || uploadedPhotos.length === 0 || isDeletingAll) return;
    setIsDeletingAll(true);
    setShowDeleteAllDialog(false);
    const totalPhotos = uploadedPhotos.length;
    try {
      const photoIds = uploadedPhotos.map((p) => p.id);

      // Call edge function directly to batch-delete all photos
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/delete-photos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ galleryId: supabaseGalleryId, photoIds }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Falha ao excluir fotos');
      }

      // Refund credits
      if (user) {
        for (let i = 0; i < totalPhotos; i++) {
          await supabase.rpc('refund_photo_credit' as any, { _user_id: user.id });
        }
        queryClient.invalidateQueries({ queryKey: ['photo-credits'] });
      }

      setUploadedPhotos([]);
      setUploadedCount(0);
      setShowUploadedPhotos(false);
    } catch (err) {
      console.error('Error deleting all photos:', err);
      toast.error('Erro ao excluir fotos. Tente novamente.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  return {
    uploadedCount,
    setUploadedCount,
    uploadedPhotos,
    setUploadedPhotos,
    showUploadedPhotos,
    setShowUploadedPhotos,
    deletingPhotoId,
    isUploadingPhotos,
    setIsUploadingPhotos,
    uploadErrorCount,
    setUploadErrorCount,
    isDeletingAll,
    showDeleteAllDialog,
    setShowDeleteAllDialog,
    handlePhotoUploadComplete,
    handleDeleteUploadedPhoto,
    handleDeleteAllPhotos,
  };
}
