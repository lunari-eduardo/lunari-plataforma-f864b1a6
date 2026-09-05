import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useSettings } from '@/hooks/useSettings';
import { useGallerySettings } from '@/hooks/useGallerySettings';
import { useSupabaseGalleries } from '@/hooks/useSupabaseGalleries';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { Client, GalleryPermission, TitleCaseMode } from '@/types/gallery';
import { DEFAULT_THEME_ID } from '@/components/gallery/themes/registry';
import { UploadedPhoto } from '@/components/PhotoUploader';

export function useDeliverCreateState() {
  const location = useLocation();
  const { clients, isLoading: isLoadingClients, createClient } = useGalleryClients();
  const { settings, updateSettings } = useSettings();
  const { settings: gallerySettings } = useGallerySettings();
  const { createGallery, updateGallery, publishGallery } = useSupabaseGalleries() as any;
  const transferStorage = useTransferStorage();

  const [currentStep, setCurrentStep] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);

  // Step 1: Data
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [subtitle, setSubtitle] = useState('Wedding Story');
  const [eventDate, setEventDate] = useState<Date | undefined>(new Date());
  const [category, setCategory] = useState('WEDDING');
  const [galleryPermission, setGalleryPermission] = useState<GalleryPermission>('public');
  const [galleryPassword, setGalleryPassword] = useState('');
  const [expirationDays, setExpirationDays] = useState(30);

  // Step 2: Visual (Font, Theme, Cover, Layout)
  const [sessionFont, setSessionFont] = useState('playfair');
  const [titleCaseMode, setTitleCaseMode] = useState<TitleCaseMode>('normal');
  const [clientMode, setClientMode] = useState<'light' | 'dark'>('dark');
  const [photoSpacing, setPhotoSpacing] = useState(6);
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [themeOverrides, setThemeOverrides] = useState<any>({});
  const [coverId, setCoverId] = useState<string | null>(null);

  // Step 3: Photos
  const [supabaseGalleryId, setSupabaseGalleryId] = useState<string | null>(null);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Step 4: Message & Confirmation
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeMessageEnabled, setWelcomeMessageEnabled] = useState(true);

  // Handle preselect client from navigation state
  useEffect(() => {
    if (location.state?.preselectClient && clients.length > 0 && !selectedClient) {
      const clientToSelect = clients.find((c) => c.id === location.state.preselectClient);
      if (clientToSelect) {
        setSelectedClient(clientToSelect);
      }
    }
  }, [location.state, clients, selectedClient]);

  // Initialize defaults from settings
  useEffect(() => {
    if (settings) {
      setExpirationDays(settings.defaultExpirationDays || 30);
      if (settings.lastSessionFont) {
        setSessionFont(settings.lastSessionFont);
      }
      if (settings.clientTheme === 'light') {
        setClientMode('light');
      } else {
        setClientMode('dark');
      }
      if (settings.defaultPhotoSpacing !== undefined) {
        setPhotoSpacing(settings.defaultPhotoSpacing);
      }
    }
  }, [settings]);

  // Initialize welcome toggle from global settings
  useEffect(() => {
    if (gallerySettings) {
      const globalEnabled = gallerySettings.welcomeMessageEnabled ?? true;
      setWelcomeMessageEnabled(globalEnabled);
    }
  }, [gallerySettings]);

  return {
    clients,
    isLoadingClients,
    createClient,
    settings,
    updateSettings,
    gallerySettings,
    createGallery,
    updateGallery,
    publishGallery,
    transferStorage,
    currentStep,
    setCurrentStep,
    isPublishing,
    setIsPublishing,
    // Step 1
    selectedClient,
    setSelectedClient,
    isClientModalOpen,
    setIsClientModalOpen,
    sessionName,
    setSessionName,
    subtitle,
    setSubtitle,
    eventDate,
    setEventDate,
    category,
    setCategory,
    galleryPermission,
    setGalleryPermission,
    galleryPassword,
    setGalleryPassword,
    expirationDays,
    setExpirationDays,
    // Step 2
    sessionFont,
    setSessionFont,
    titleCaseMode,
    setTitleCaseMode,
    clientMode,
    setClientMode,
    photoSpacing,
    setPhotoSpacing,
    useCustomTheme,
    setUseCustomTheme,
    activeThemeId,
    setActiveThemeId,
    themeOverrides,
    setThemeOverrides,
    coverId,
    setCoverId,
    // Step 3
    supabaseGalleryId,
    setSupabaseGalleryId,
    isCreatingGallery,
    setIsCreatingGallery,
    uploadedPhotos,
    setUploadedPhotos,
    isUploading,
    setIsUploading,
    photoRefreshKey,
    setPhotoRefreshKey,
    coverPhotoId,
    setCoverPhotoId,
    photoCount,
    setPhotoCount,
    activeFolderId,
    setActiveFolderId,
    // Step 4
    welcomeMessage,
    setWelcomeMessage,
    welcomeMessageEnabled,
    setWelcomeMessageEnabled,
  };
}
