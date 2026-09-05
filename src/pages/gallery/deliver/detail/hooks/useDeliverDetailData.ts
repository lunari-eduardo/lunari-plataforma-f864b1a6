import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { supabase } from '@/integrations/supabase/client';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { useSettings } from '@/hooks/useSettings';
import { DEFAULT_THEME_ID } from '@/components/gallery/themes/registry';

export function useDeliverDetailData() {
  const { id } = useParams<{ id: string }>();
  const {
    galleries,
    getGallery,
    fetchGalleryPhotos,
    updateGallery,
    deleteGallery,
    deletePhoto,
    isLoading: galleriesLoading,
  } = useSupabaseGalleries();

  const transferStorage = useTransferStorage();
  const { settings } = useSettings();

  const [photos, setPhotos] = useState<GaleriaPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);

  // Editable fields
  const [sessionName, setSessionName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [galleryPassword, setGalleryPassword] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [shareMessage, setShareMessage] = useState('Suas fotos finais estão prontas para download.');
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [photoSpacing, setPhotoSpacing] = useState(6);
  const [activeThemeId, setActiveThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [themeOverrides, setThemeOverrides] = useState<any>({});
  const [coverId, setCoverId] = useState<string | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('');
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);

  const gallery = useMemo(() => getGallery(id || ''), [id, galleries]);

  // Resolve client ID (from gallery directly, or fallback to session/name search)
  const { data: resolvedClienteId } = useQuery({
    queryKey: ['gallery-resolved-client', gallery?.clienteId, gallery?.sessionId, gallery?.clienteNome],
    queryFn: async () => {
      if (gallery?.clienteId) return gallery.clienteId;

      if (gallery?.sessionId) {
        const { data: sess } = await supabase
          .from('clientes_sessoes')
          .select('cliente_id')
          .eq('session_id', gallery.sessionId)
          .maybeSingle();
        if (sess?.cliente_id) return sess.cliente_id;
      }

      if (gallery?.clienteNome) {
        const { data: client } = await supabase
          .from('clientes')
          .select('id')
          .ilike('nome', gallery.clienteNome.trim())
          .limit(1)
          .maybeSingle();
        if (client?.id) return client.id;
      }

      return null;
    },
    enabled: !!gallery,
  });

  const effectiveClienteId = gallery?.clienteId || resolvedClienteId;

  // Load gallery data
  useEffect(() => {
    if (gallery) {
      setSessionName(gallery.nomeSessao || '');
      setSubtitle((gallery.configuracoes as any)?.subtitulo || '');
      setCategory((gallery.configuracoes as any)?.categoria || '');
      const rawDate = (gallery.configuracoes as any)?.dataEvento;
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) setEventDate(d);
        } catch {}
      } else {
        setEventDate(undefined);
      }
      setWelcomeMessage(gallery.mensagemBoasVindas || '');
      setWelcomeEnabled(!!gallery.mensagemBoasVindas);
      setInternalNotes((gallery.configuracoes as any)?.notasInternas || '');
      setIsPrivate(gallery.permissao === 'private');
      setGalleryPassword(gallery.galleryPassword || '');
      setExpirationDate(gallery.prazoSelecao || undefined);
      setCoverPhotoId(gallery.configuracoes?.coverPhotoId || null);
      setActiveThemeId(gallery.themeId || DEFAULT_THEME_ID);
      setUseCustomTheme(gallery.useCustomTheme || false);
      setThemeOverrides(gallery.themeOverrides || {});
      setCoverId((gallery as any).coverId ?? null);

      // Migrate legacy gap to overrides if needed
      const legacyGap = gallery.configuracoes?.photoSpacing;
      if (legacyGap !== undefined && !gallery.themeOverrides?.layout?.gap) {
        setThemeOverrides((prev: any) => ({
          ...prev,
          layout: { ...(prev.layout || {}), gap: legacyGap }
        }));
      }
    }
  }, [gallery]);

  // Load photos
  useEffect(() => {
    if (!id) return;
    setPhotosLoading(true);
    fetchGalleryPhotos(id)
      .then(setPhotos)
      .catch(console.error)
      .finally(() => setPhotosLoading(false));
  }, [id]);

  const reloadPhotos = () => {
    if (id) {
      fetchGalleryPhotos(id).then(setPhotos);
    }
  };

  return {
    id,
    gallery,
    galleriesLoading,
    photos,
    setPhotos,
    photosLoading,
    effectiveClienteId,
    transferStorage,
    settings,
    updateGallery,
    deleteGallery,
    deletePhoto,
    reloadPhotos,
    // Fields
    sessionName,
    setSessionName,
    welcomeMessage,
    setWelcomeMessage,
    welcomeEnabled,
    setWelcomeEnabled,
    internalNotes,
    setInternalNotes,
    isPrivate,
    setIsPrivate,
    galleryPassword,
    setGalleryPassword,
    expirationDate,
    setExpirationDate,
    shareMessage,
    setShareMessage,
    coverPhotoId,
    setCoverPhotoId,
    photoSpacing,
    setPhotoSpacing,
    activeThemeId,
    setActiveThemeId,
    useCustomTheme,
    setUseCustomTheme,
    themeOverrides,
    setThemeOverrides,
    coverId,
    setCoverId,
    previewViewport,
    setPreviewViewport,
    subtitle,
    setSubtitle,
    category,
    setCategory,
    eventDate,
    setEventDate,
  };
}
