import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { toast } from 'sonner';
import { ClientFormData } from '@/components/ClientModal';
import { UploadedPhoto } from '@/components/PhotoUploader';
import { useDeliverCreateState } from './useDeliverCreateState';
import { DELIVER_STEPS } from '../types';

type DeliverCreateState = ReturnType<typeof useDeliverCreateState>;

export function useDeliverCreateActions(state: DeliverCreateState) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    createClient,
    createGallery,
    updateGallery,
    publishGallery,
    updateSettings,
    currentStep,
    setCurrentStep,
    isPublishing,
    setIsPublishing,
    selectedClient,
    setSelectedClient,
    setIsClientModalOpen,
    sessionName,
    subtitle,
    eventDate,
    category,
    galleryPermission,
    galleryPassword,
    expirationDays,
    sessionFont,
    titleCaseMode,
    clientMode,
    photoSpacing,
    useCustomTheme,
    activeThemeId,
    themeOverrides,
    coverId,
    supabaseGalleryId,
    setSupabaseGalleryId,
    setIsCreatingGallery,
    uploadedPhotos,
    setUploadedPhotos,
    setPhotoRefreshKey,
    coverPhotoId,
    setCoverPhotoId,
    photoCount,
    welcomeMessage,
    welcomeMessageEnabled,
  } = state;

  const handleClientCreate = async (data: ClientFormData) => {
    const newClient = await createClient(data);
    if (newClient) {
      setSelectedClient(newClient);
      setIsClientModalOpen(false);
    }
  };

  const ensureGalleryCreated = async () => {
    if (supabaseGalleryId) {
      try {
        await updateGallery({
          id: supabaseGalleryId,
          data: {
            nomeSessao: sessionName,
            permissao: galleryPermission,
            prazoSelecaoDias: expirationDays,
            configuracoes: {
              imageResizeOption: 2560,
              allowDownload: true,
              allowComments: false,
              allowExtraPhotos: false,
              watermark: { type: 'none', opacity: 0, position: 'center' },
              watermarkDisplay: 'none',
              sessionFont,
              titleCaseMode,
              clientMode,
              photoSpacing: useCustomTheme ? (themeOverrides?.layout?.gap ?? photoSpacing) : photoSpacing,
              subtitulo: subtitle.trim() || undefined,
              dataEvento: eventDate ? eventDate.toISOString() : undefined,
              categoria: category.trim() || undefined,
            },
            themeId: useCustomTheme ? activeThemeId : null,
            useCustomTheme: useCustomTheme,
            themeOverrides: themeOverrides,
            coverId: coverId,
          },
        });
        return supabaseGalleryId;
      } catch (e) {
        console.error('Error updating existing gallery:', e);
      }
    }

    setIsCreatingGallery(true);
    try {
      const result = await createGallery({
        clienteId: selectedClient?.id || null,
        clienteNome: selectedClient?.name || null,
        clienteEmail: selectedClient?.email || null,
        nomeSessao: sessionName,
        fotosIncluidas: 0,
        valorFotoExtra: 0,
        permissao: galleryPermission,
        galleryPassword: galleryPermission === 'private' ? galleryPassword : undefined,
        prazoSelecaoDias: expirationDays,
        tipo: 'entrega',
        configuracoes: {
          imageResizeOption: 2560,
          allowDownload: true,
          allowComments: false,
          allowExtraPhotos: false,
          watermark: { type: 'none', opacity: 0, position: 'center' },
          watermarkDisplay: 'none',
          sessionFont,
          titleCaseMode,
          clientMode,
          photoSpacing: useCustomTheme ? (themeOverrides?.layout?.gap ?? photoSpacing) : photoSpacing,
          subtitulo: subtitle.trim() || undefined,
          dataEvento: eventDate ? eventDate.toISOString() : undefined,
          categoria: category.trim() || undefined,
        },
        themeId: useCustomTheme ? activeThemeId : null,
        useCustomTheme: useCustomTheme,
        themeOverrides: themeOverrides,
        coverId: coverId,
      });
      setSupabaseGalleryId(result.id);
      return result.id;
    } catch (error) {
      console.error('Error creating deliver gallery:', error);
      toast.error('Erro ao criar galeria de entrega');
      return null;
    } finally {
      setIsCreatingGallery(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!sessionName.trim()) {
        toast.error('Informe o nome da sessão');
        return;
      }
      if (galleryPermission === 'private' && !galleryPassword.trim()) {
        toast.error('Informe a senha para galeria privada');
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      const id = await ensureGalleryCreated();
      if (!id) return;
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      if (photoCount === 0 && uploadedPhotos.length === 0) {
        toast.error('Envie pelo menos uma foto');
        return;
      }
      setCurrentStep(4);
      return;
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      navigate('/app/gallery/list?tab=transfer');
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 1));
    }
  };

  const handlePublish = async () => {
    if (!supabaseGalleryId || isPublishing) return;

    setIsPublishing(true);
    try {
      const expirationDate = addDays(new Date(), expirationDays);

      await updateGallery({
        id: supabaseGalleryId,
        data: {
          mensagemBoasVindas: welcomeMessageEnabled ? (welcomeMessage.trim() || undefined) : undefined,
          prazoSelecaoDias: expirationDays,
          prazoSelecao: expirationDate,
          configuracoes: {
            imageResizeOption: 2560,
            allowDownload: true,
            allowComments: false,
            allowExtraPhotos: false,
            watermark: { type: 'none', opacity: 0, position: 'center' },
            watermarkDisplay: 'none',
            sessionFont,
            titleCaseMode,
            coverPhotoId: coverPhotoId || undefined,
            clientMode,
            photoSpacing: useCustomTheme ? (themeOverrides?.layout?.gap ?? photoSpacing) : photoSpacing,
            subtitulo: subtitle.trim() || undefined,
            dataEvento: eventDate ? eventDate.toISOString() : undefined,
            categoria: category.trim() || undefined,
          },
          coverId: coverId,
        },
      });

      updateSettings({ lastSessionFont: sessionFont });

      if (publishGallery) {
        await publishGallery(supabaseGalleryId);
      }

      queryClient.invalidateQueries({ queryKey: ['galleries'] });
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-storage'] });
      queryClient.invalidateQueries({ queryKey: ['client-gallery', supabaseGalleryId] });

      toast.success('Entrega criada e publicada com sucesso!');
      navigate(`/app/gallery/transfer/${supabaseGalleryId}`);
    } catch (error) {
      console.error('Error publishing deliver gallery:', error);
      toast.error('Erro ao publicar galeria');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUploadComplete = (photos: UploadedPhoto[]) => {
    setUploadedPhotos((prev) => [...prev, ...photos]);
    setPhotoRefreshKey((k) => k + 1);
  };

  const handleCoverChange = async (photoId: string | null) => {
    setCoverPhotoId(photoId);
    if (supabaseGalleryId) {
      try {
        const { data: gallery } = await (await import('@/integrations/supabase/client')).supabase
          .from('galerias')
          .select('configuracoes')
          .eq('id', supabaseGalleryId)
          .single();

        const existingConfig = (gallery?.configuracoes as Record<string, unknown>) || {};
        await updateGallery({
          id: supabaseGalleryId,
          data: {
            configuracoes: {
              ...existingConfig,
              coverPhotoId: photoId,
            },
          },
        });
      } catch (e) {
        console.error('Error saving cover photo:', e);
      }
    }
  };

  return {
    handleClientCreate,
    ensureGalleryCreated,
    handleNext,
    handleBack,
    handlePublish,
    handleUploadComplete,
    handleCoverChange,
    stepsCount: DELIVER_STEPS.length,
  };
}
