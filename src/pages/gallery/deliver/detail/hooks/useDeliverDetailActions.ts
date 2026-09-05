import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, isPast } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { buildWhatsAppUrl } from '@/lib/whatsappUrl';
import { useDeliverDetailData } from './useDeliverDetailData';
import { UploadedPhoto } from '@/components/PhotoUploader';

type DeliverData = ReturnType<typeof useDeliverDetailData>;

export function useDeliverDetailActions(data: DeliverData) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showUploader, setShowUploader] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [reactivateSuccessOpen, setReactivateSuccessOpen] = useState(false);
  const [reactivateDays, setReactivateDays] = useState(7);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const {
    id,
    gallery,
    sessionName,
    welcomeEnabled,
    welcomeMessage,
    isPrivate,
    coverId,
    expirationDate,
    setExpirationDate,
    internalNotes,
    coverPhotoId,
    setCoverPhotoId,
    themeOverrides,
    photoSpacing,
    subtitle,
    category,
    eventDate,
    useCustomTheme,
    activeThemeId,
    shareMessage,
    updateGallery,
    deleteGallery,
    deletePhoto,
    setPhotos,
    reloadPhotos,
  } = data;

  const handleSave = async () => {
    if (!id || !gallery) return;
    setSaving(true);
    try {
      await updateGallery({
        id,
        data: {
          nomeSessao: sessionName,
          mensagemBoasVindas: welcomeEnabled ? (welcomeMessage.trim() || null) : null,
          permissao: isPrivate ? 'private' : 'public',
          coverId: coverId,
          prazoSelecao: expirationDate,
          configuracoes: {
            ...gallery.configuracoes,
            notasInternas: internalNotes,
            coverPhotoId: coverPhotoId || undefined,
            photoSpacing: themeOverrides?.layout?.gap ?? photoSpacing,
            subtitulo: subtitle.trim() || undefined,
            categoria: category.trim() || undefined,
            dataEvento: eventDate ? eventDate.toISOString() : undefined,
          } as any,
          themeId: useCustomTheme ? activeThemeId : null,
          useCustomTheme: useCustomTheme,
          themeOverrides: themeOverrides,
        },
      });

      navigate('/app/gallery/list?tab=transfer');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id || !gallery || isPublishing) return;
    setIsPublishing(true);
    try {
      let newExpiration = gallery.prazoSelecao;
      if (!newExpiration || isPast(newExpiration)) {
        newExpiration = addDays(new Date(), gallery.prazoSelecaoDias || 30);
        setExpirationDate(newExpiration);
      }

      const nowIso = new Date().toISOString();

      await supabase.rpc('prepare_gallery_share', {
        p_gallery_id: id,
        p_mark_as_sent: true,
      });

      const { error: updateError } = await supabase
        .from('galerias')
        .update({
          status: 'enviado',
          published_at: nowIso,
          enviado_em: nowIso,
          updated_at: nowIso,
          prazo_selecao: newExpiration ? newExpiration.toISOString() : null,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating gallery status:', updateError);
      }

      await queryClient.invalidateQueries({ queryKey: ['galleries'] });
      await queryClient.invalidateQueries({ queryKey: ['galerias'] });
      await queryClient.invalidateQueries({ queryKey: ['client-gallery', id] });
      await queryClient.refetchQueries({ queryKey: ['galleries'] });

      toast.success('Entrega publicada com sucesso!');
    } catch (error) {
      console.error('Erro ao publicar galeria:', error);
      toast.error('Erro ao publicar galeria');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteGallery(id);
    navigate('/app/gallery/list?tab=transfer');
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!id) return;
    await deletePhoto({ photoId } as any);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    if (coverPhotoId === photoId) {
      setCoverPhotoId(null);
      try {
        await updateGallery({
          id,
          data: {
            configuracoes: { ...(gallery?.configuracoes as any), coverPhotoId: null },
          },
        });
      } catch (e) {
        console.error('Erro ao limpar capa após exclusão:', e);
      }
    }
  };

  const handleSetCover = async (photoId: string) => {
    if (!id) return;
    const newCoverId = coverPhotoId === photoId ? null : photoId;
    setCoverPhotoId(newCoverId);
    try {
      await updateGallery({
        id,
        data: {
          configuracoes: { ...(gallery?.configuracoes as any), coverPhotoId: newCoverId },
        },
      });
    } catch {
      toast.error('Erro ao atualizar capa');
      setCoverPhotoId(coverPhotoId);
    }
  };

  const handleToggleHighlight = async (photoId: string, currentWeight: number) => {
    const newWeight = currentWeight > 0 ? 0 : 1;
    setPhotos(prev => prev.map(p => (p.id === photoId ? { ...p, pesoVisual: newWeight } : p)));
    const { error } = await supabase
      .from('galeria_fotos')
      .update({ peso_visual: newWeight })
      .eq('id', photoId);

    if (error) {
      setPhotos(prev => prev.map(p => (p.id === photoId ? { ...p, pesoVisual: currentWeight } : p)));
      toast.error('Erro ao atualizar destaque');
      return;
    }
    toast.success(newWeight > 0 ? 'Foto destacada' : 'Destaque removido');
  };

  const handleUploadComplete = (_uploaded: UploadedPhoto[]) => {
    setShowUploader(false);
    reloadPhotos();
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsLinkCopied(true);
      toast.success('Link copiado para a área de transferência!');
      setTimeout(() => setIsLinkCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  const openWhatsApp = async (galleryUrl: string) => {
    if (!gallery) return;
    const message = `${shareMessage}\n\n${galleryUrl}`;
    const { url, hasDirectContact } = buildWhatsAppUrl(gallery.clienteTelefone, message);
    if (!hasDirectContact) {
      try {
        await navigator.clipboard.writeText(message);
      } catch {
        // ignora
      }
      toast.info('Cliente sem telefone cadastrado. A mensagem foi copiada — escolha o contato no WhatsApp e cole.');
    }
    window.open(url, '_blank');
  };

  return {
    showUploader,
    setShowUploader,
    saving,
    isPublishing,
    showReactivateDialog,
    setShowReactivateDialog,
    reactivateSuccessOpen,
    setReactivateSuccessOpen,
    reactivateDays,
    setReactivateDays,
    isLinkCopied,
    showEmailModal,
    setShowEmailModal,
    handleSave,
    handlePublish,
    handleDelete,
    handlePhotoDelete,
    handleSetCover,
    handleToggleHighlight,
    handleUploadComplete,
    copyToClipboard,
    openWhatsApp,
  };
}
