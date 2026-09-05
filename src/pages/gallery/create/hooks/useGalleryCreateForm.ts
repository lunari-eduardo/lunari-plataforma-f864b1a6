import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { PaymentMethod, SaleSettings } from '@/types/gallery';
import { useGalleryFormState } from './useGalleryFormState';
import { useAssistedSession } from './useAssistedSession';
import { useGalleryPhotos } from './useGalleryPhotos';
import { useGallerySubmit } from './useGallerySubmit';
import { useGalleryDefaultSettings } from './useGalleryDefaultSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useGestaoParams } from '@/hooks/useGestaoParams';
import { useGestaoPackages } from '@/hooks/useGestaoPackages';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useSettings } from '@/hooks/useSettings';
import { useGallerySettings } from '@/hooks/useGallerySettings';
import { usePaymentIntegration } from '@/hooks/usePaymentIntegration';
import { useWatermarkSettings } from '@/hooks/useWatermarkSettings';
import { useSupabaseGalleries } from '@/hooks/useSupabaseGalleries';
import { ClientFormData } from '@/components/ClientModal';

export function useGalleryCreateForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const hasGestaoIntegration = !!(user as any)?.hasGestaoIntegration;

  const {
    gestaoParams,
    isAssistedMode: hasGestaoSession,
    paramsProcessed,
    markAsProcessed,
    clearParams,
  } = useGestaoParams();

  const { packages: gestaoPackages, isLoading: isLoadingPackages } = useGestaoPackages();
  const isAssistedMode = hasGestaoSession && hasGestaoIntegration;

  const {
    clients,
    isLoading: isLoadingClients,
    createClient,
    updateClient,
    fetchClientById,
    addClientToCache,
  } = useGalleryClients();

  const { settings, updateSettings } = useSettings();
  const {
    createDiscountPreset,
    updateDiscountPreset,
    deleteDiscountPreset,
  } = useGallerySettings();
  const { settings: watermarkSettings } = useWatermarkSettings();
  const { settings: watermarkGlobalSettings } = useWatermarkSettings();
  const { data: paymentData } = usePaymentIntegration();

  const formState = useGalleryFormState();

  const {
    createGallery: createSupabaseGallery,
    updateGallery,
    publishGallery: publishSupabaseGallery,
    deletePhoto,
  } = useSupabaseGalleries();

  const photoManager = useGalleryPhotos({
    supabaseGalleryId: formState.supabaseGalleryId,
    user,
    deletePhoto: deletePhoto as any,
  });

  const {
    regrasCongeladas,
    isLoadingRegras,
    regrasLoaded,
    priorDeletion,
  } = useAssistedSession({
    gestaoParams,
    hasGestaoSession,
    isAssistedMode,
    hasGestaoIntegration,
    clients,
    isLoadingClients,
    gestaoPackages,
    isLoadingPackages,
    paramsProcessed,
    markAsProcessed,
    clearParams,
    fetchClientById,
    addClientToCache,
    createClient,
    setSelectedClient: formState.setSelectedClient,
    setUseExistingPassword: formState.setUseExistingPassword,
    packageName: formState.packageName,
    setPackageName: formState.setPackageName,
    userTouchedPackageNameRef: formState.userTouchedPackageNameRef,
    setIncludedPhotos: formState.setIncludedPhotos,
    setFixedPrice: formState.setFixedPrice,
    setSaleMode: formState.setSaleMode,
    userTouchedSaleModeRef: formState.userTouchedSaleModeRef,
    setPricingModel: formState.setPricingModel,
    userTouchedPricingModelRef: formState.userTouchedPricingModelRef,
  });

  useEffect(() => {
    if (location.state?.preselectClient && clients.length > 0 && !formState.selectedClient) {
      const toSelect = clients.find((c) => c.id === location.state.preselectClient);
      if (toSelect) formState.setSelectedClient(toSelect);
    }
  }, [location.state, clients, formState.selectedClient, formState.setSelectedClient]);

  useGalleryDefaultSettings({
    settings,
    gestaoParams,
    watermarkGlobalSettings,
    paymentData,
    selectedPaymentMethod: formState.selectedPaymentMethod,
    setSelectedPaymentMethod: formState.setSelectedPaymentMethod,
    setCustomDays: formState.setCustomDays,
    setGalleryPermission: formState.setGalleryPermission,
    setSelectedThemeId: formState.setSelectedThemeId,
    setClientMode: formState.setClientMode,
    setSessionFont: formState.setSessionFont,
    setWelcomeMessageEnabled: formState.setWelcomeMessageEnabled,
    setWelcomeMessage: formState.setWelcomeMessage,
    setSaleMode: formState.setSaleMode,
    setImageResizeOption: formState.setImageResizeOption,
    setChargeType: formState.setChargeType,
    setPricingModel: formState.setPricingModel,
    setAllowComments: formState.setAllowComments,
    setAllowDownload: formState.setAllowDownload,
    setAllowExtraPhotos: formState.setAllowExtraPhotos,
    setWatermarkDisplay: formState.setWatermarkDisplay,
    setWatermarkType: formState.setWatermarkType,
    setWatermarkOpacity: formState.setWatermarkOpacity,
    userTouchedClientModeRef: formState.userTouchedClientModeRef,
    userTouchedTypographyRef: formState.userTouchedTypographyRef,
    userTouchedSaleModeRef: formState.userTouchedSaleModeRef,
    userTouchedImageResizeRef: formState.userTouchedImageResizeRef,
    userTouchedChargeTypeRef: formState.userTouchedChargeTypeRef,
    userTouchedPricingModelRef: formState.userTouchedPricingModelRef,
    userTouchedAllowCommentsRef: formState.userTouchedAllowCommentsRef,
    userTouchedAllowDownloadRef: formState.userTouchedAllowDownloadRef,
    userTouchedAllowExtraPhotosRef: formState.userTouchedAllowExtraPhotosRef,
    userTouchedWatermarkDisplayRef: formState.userTouchedWatermarkDisplayRef,
    userTouchedPaymentMethodRef: formState.userTouchedPaymentMethodRef,
  });

  const getEffectivePaymentMethod = (): PaymentMethod | null => {
    if (formState.saleMode !== 'sale_with_payment') return null;
    return (
      formState.selectedPaymentMethod ||
      settings?.defaultPaymentMethod ||
      (paymentData?.defaultIntegration?.provedor as PaymentMethod) ||
      null
    );
  };

  const getSaleSettings = (): SaleSettings => ({
    mode: formState.saleMode,
    pricingModel: formState.pricingModel,
    chargeType: formState.chargeType,
    fixedPrice: formState.fixedPrice,
    discountPackages: formState.discountPackages,
    paymentMethod: getEffectivePaymentMethod() || undefined,
  });

  const getPaymentMethodLabel = () => {
    const method = getEffectivePaymentMethod();
    switch (method) {
      case 'mercadopago': return 'Mercado Pago';
      case 'infinitepay': return 'InfinitePay';
      case 'asaas': return 'Asaas';
      case 'pix_manual': return 'PIX Manual';
      default: return method || 'Não definido';
    }
  };

  const getSaleModeLabel = () => {
    switch (formState.saleMode) {
      case 'no_sale': return 'Sem venda';
      case 'sale_with_payment': return 'Venda COM pagamento';
      case 'sale_without_payment': return 'Venda SEM pagamento';
    }
  };

  const getPricingModelLabel = () => {
    switch (formState.pricingModel) {
      case 'fixed': return 'Preço único';
      case 'packages': return 'Pacotes com desconto';
    }
  };

  const getChargeTypeLabel = () => {
    switch (formState.chargeType) {
      case 'only_extras': return 'Apenas extras';
      case 'all_selected': return 'Todas selecionadas';
    }
  };

  const handleClientSelect = (client: any) => {
    formState.setSelectedClient(client);
    if (client) {
      formState.setUseExistingPassword(!!client.galleryPassword);
      formState.setNewPassword('');
    }
  };

  const handleSaveClient = async (clientData: ClientFormData) => {
    try {
      const newClient = await createClient(clientData);
      formState.setSelectedClient(newClient);
      formState.setUseExistingPassword(true);
      formState.setIsClientModalOpen(false);
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Erro ao cadastrar cliente');
    }
  };

  const {
    isAdvancing,
    isGoingBack,
    isSavingDraft,
    createSupabaseGalleryForUploads,
    handleNext,
    handleBack,
    handleSaveDraft,
  } = useGallerySubmit({
    currentStep: formState.currentStep,
    setCurrentStep: formState.setCurrentStep,
    supabaseGalleryId: formState.supabaseGalleryId,
    setSupabaseGalleryId: formState.setSupabaseGalleryId,
    creatingGalleryRef: formState.creatingGalleryRef,
    isCreatingGallery: formState.isCreatingGallery,
    setIsCreatingGallery: formState.setIsCreatingGallery,
    activeFolderId: formState.activeFolderId,
    setActiveFolderId: formState.setActiveFolderId,
    galleryPermission: formState.galleryPermission,
    passwordDisabled: formState.passwordDisabled,
    useExistingPassword: formState.useExistingPassword,
    newPassword: formState.newPassword,
    savePasswordToClient: formState.savePasswordToClient,
    selectedClient: formState.selectedClient,
    sessionName: formState.sessionName,
    packageName: formState.packageName,
    includedPhotos: formState.includedPhotos,
    customDays: formState.customDays,
    saleMode: formState.saleMode,
    pricingModel: formState.pricingModel,
    chargeType: formState.chargeType,
    fixedPrice: formState.fixedPrice,
    discountPackages: formState.discountPackages,
    regrasCongeladas,
    overridePricing: false,
    isAssistedMode,
    regrasLoaded,
    gestaoParams,
    welcomeMessage: formState.welcomeMessage,
    watermarkType: formState.watermarkType,
    watermarkOpacity: formState.watermarkOpacity,
    watermarkDisplay: formState.watermarkDisplay,
    imageResizeOption: formState.imageResizeOption,
    allowComments: formState.allowComments,
    allowDownload: formState.allowDownload,
    allowExtraPhotos: formState.allowExtraPhotos,
    selectedThemeId: formState.selectedThemeId,
    clientMode: formState.clientMode,
    sessionFont: formState.sessionFont,
    titleCaseMode: formState.titleCaseMode,
    getEffectivePaymentMethod,
    getSaleSettings,
    photoManager,
    priorDeletion,
    recreateConfirmed: formState.recreateConfirmed,
    setShowRecreateDialog: formState.setShowRecreateDialog,
    updateClient,
    createSupabaseGallery,
    updateGallery,
    publishSupabaseGallery,
    updateSettings,
    navigate,
  });

  return {
    ...formState,
    isAdvancing,
    isGoingBack,
    isSavingDraft,
    handleNext,
    handleBack,
    handleSaveDraft,
    createSupabaseGalleryForUploads,
    photoManager,
    regrasCongeladas,
    isLoadingRegras,
    regrasLoaded,
    priorDeletion,
    overridePricing: false,
    setOverridePricing: (_v: boolean) => {},
    clients,
    isLoadingClients,
    gestaoPackages,
    isLoadingPackages,
    settings,
    paymentData,
    watermarkSettings,
    isAssistedMode,
    hasGestaoSession,
    hasGestaoIntegration,
    gestaoParams,
    handleClientSelect,
    handleSaveClient,
    getSaleModeLabel,
    getPaymentMethodLabel,
    getPricingModelLabel,
    getChargeTypeLabel,
    createDiscountPreset,
    updateDiscountPreset,
    deleteDiscountPreset,
    onSessionNameTouched: () => { formState.userTouchedSessionNameRef.current = true; },
    onPackageNameTouched: () => { formState.userTouchedPackageNameRef.current = true; },
    onTypographyTouched: () => { formState.userTouchedTypographyRef.current = true; },
    onSaleModeTouched: () => { formState.userTouchedSaleModeRef.current = true; },
    onPricingModelTouched: () => { formState.userTouchedPricingModelRef.current = true; },
    onPaymentMethodTouched: () => { formState.userTouchedPaymentMethodRef.current = true; },
    onChargeTypeTouched: () => { formState.userTouchedChargeTypeRef.current = true; },
    onImageResizeTouched: () => { formState.userTouchedImageResizeRef.current = true; },
    onClientModeTouched: () => { formState.userTouchedClientModeRef.current = true; },
    onAllowCommentsTouched: () => { formState.userTouchedAllowCommentsRef.current = true; },
    onAllowDownloadTouched: () => { formState.userTouchedAllowDownloadRef.current = true; },
    onAllowExtraPhotosTouched: () => { formState.userTouchedAllowExtraPhotosRef.current = true; },
  };
}
