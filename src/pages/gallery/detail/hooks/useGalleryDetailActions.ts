import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LightboxSource } from '../types';

interface UseGalleryDetailActionsProps {
  galleryId: string | undefined;
  sendSupabaseGallery: (id: string) => Promise<any>;
  reopenSupabaseSelection: (params: { id: string; days: number }) => Promise<any>;
  deleteSupabaseGallery: (id: string) => Promise<any>;
}

export function useGalleryDetailActions({
  galleryId,
  sendSupabaseGallery,
  reopenSupabaseSelection,
  deleteSupabaseGallery,
}: UseGalleryDetailActionsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [lightboxState, setLightboxState] = useState<{ source: LightboxSource; index: number } | null>(null);
  const [isCodesModalOpen, setIsCodesModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivateSuccessOpen, setReactivateSuccessOpen] = useState(false);
  const [reactivateDays, setReactivateDays] = useState(7);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);

  const handleSendGallery = async () => {
    if (!galleryId) return;
    try {
      await sendSupabaseGallery(galleryId);
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      queryClient.invalidateQueries({ queryKey: ['client-gallery', galleryId] });
    } catch (error) {
      console.error('Error sending gallery:', error);
    }
  };

  const handleReopenSelection = async (days: number) => {
    if (!galleryId) return;
    await reopenSupabaseSelection({ id: galleryId, days });
    await queryClient.invalidateQueries({ queryKey: ['galleries'] });
    await queryClient.invalidateQueries({ queryKey: ['galerias'] });
    await queryClient.invalidateQueries({ queryKey: ['client-gallery', galleryId] });
    await queryClient.refetchQueries({ queryKey: ['galleries'] });
  };

  const handleDeleteGallery = async () => {
    if (!galleryId) return;
    await deleteSupabaseGallery(galleryId);
    navigate('/app/gallery/list');
  };

  const handleCopyCode = useCallback((code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setIsCodeCopied(true);
    toast.success('Código copiado para a área de transferência!');
    setTimeout(() => setIsCodeCopied(false), 2500);
  }, []);

  return {
    lightboxState,
    setLightboxState,
    isCodesModalOpen,
    setIsCodesModalOpen,
    isSendModalOpen,
    setIsSendModalOpen,
    reactivateOpen,
    setReactivateOpen,
    reactivateSuccessOpen,
    setReactivateSuccessOpen,
    reactivateDays,
    setReactivateDays,
    deleteDialogOpen,
    setDeleteDialogOpen,
    mobileMenuOpen,
    setMobileMenuOpen,
    isCodeCopied,
    handleSendGallery,
    handleReopenSelection,
    handleDeleteGallery,
    handleCopyCode,
  };
}
