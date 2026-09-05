import { useState, useRef } from 'react';
import { defaultWelcomeMessage } from '@/data/mockData';
import { generateId } from '@/lib/storage';
import {
  GalleryPermission,
  Client,
  SaleMode,
  PricingModel,
  ChargeType,
  DiscountPackage,
  PaymentMethod,
  TitleCaseMode,
  ImageResizeOption,
  WatermarkType,
  WatermarkDisplay,
} from '@/types/gallery';

export function useGalleryFormState() {
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Client Info
  const [galleryPermission, setGalleryPermission] = useState<GalleryPermission>('private');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [useExistingPassword, setUseExistingPassword] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [passwordDisabled, setPasswordDisabled] = useState(false);
  const [savePasswordToClient, setSavePasswordToClient] = useState(true);
  const [sessionName, setSessionName] = useState('');
  const [sessionFont, setSessionFont] = useState('playfair');
  const [titleCaseMode, setTitleCaseMode] = useState<TitleCaseMode>('normal');
  const [packageName, setPackageName] = useState('');
  const [includedPhotos, setIncludedPhotos] = useState(30);

  // Step 2: Sale Settings
  const [saleMode, setSaleMode] = useState<SaleMode>('sale_without_payment');
  const [pricingModel, setPricingModel] = useState<PricingModel>('fixed');
  const [chargeType, setChargeType] = useState<ChargeType>('only_extras');
  const [fixedPrice, setFixedPrice] = useState(25);
  const [discountPackages, setDiscountPackages] = useState<DiscountPackage[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  // Step 3 / 4: Uploads and galleries
  const [supabaseGalleryId, setSupabaseGalleryId] = useState<string | null>(null);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const creatingGalleryRef = useRef(false);
  const [showRecreateDialog, setShowRecreateDialog] = useState(false);
  const [recreateConfirmed, setRecreateConfirmed] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Step 3 / 5: Settings & Message
  const [welcomeMessage, setWelcomeMessage] = useState(defaultWelcomeMessage);
  const [welcomeMessageEnabled, setWelcomeMessageEnabled] = useState(true);
  const [customDays, setCustomDays] = useState(10);
  const [imageResizeOption, setImageResizeOption] = useState<ImageResizeOption>(1920);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>('standard');
  const [watermarkOpacity, setWatermarkOpacity] = useState(40);
  const [watermarkDisplay, setWatermarkDisplay] = useState<WatermarkDisplay>('all');
  const [allowComments, setAllowComments] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowExtraPhotos, setAllowExtraPhotos] = useState(true);
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>();
  const [clientMode, setClientMode] = useState<'light' | 'dark'>('light');

  // User touched refs
  const userTouchedSaleModeRef = useRef(false);
  const userTouchedImageResizeRef = useRef(false);
  const userTouchedChargeTypeRef = useRef(false);
  const userTouchedPricingModelRef = useRef(false);
  const userTouchedPaymentMethodRef = useRef(false);
  const userTouchedAllowCommentsRef = useRef(false);
  const userTouchedAllowDownloadRef = useRef(false);
  const userTouchedAllowExtraPhotosRef = useRef(false);
  const userTouchedWatermarkDisplayRef = useRef(false);
  const userTouchedClientModeRef = useRef(false);
  const userTouchedSessionNameRef = useRef(false);
  const userTouchedPackageNameRef = useRef(false);
  const userTouchedTypographyRef = useRef(false);

  const addDiscountPackage = () => {
    const updatedPackages = [...discountPackages];
    if (updatedPackages.length > 0) {
      const lastIndex = updatedPackages.length - 1;
      const lastPkg = updatedPackages[lastIndex];
      if (lastPkg.maxPhotos === null) {
        updatedPackages[lastIndex] = {
          ...lastPkg,
          maxPhotos: lastPkg.minPhotos + 9,
        };
      }
    }
    const lastPackage = updatedPackages[updatedPackages.length - 1];
    const minPhotos = lastPackage ? (lastPackage.maxPhotos as number) + 1 : 1;
    setDiscountPackages([
      ...updatedPackages,
      {
        id: generateId(),
        minPhotos,
        maxPhotos: null,
        pricePerPhoto: Math.max(1, fixedPrice - (discountPackages.length + 1) * 5),
      },
    ]);
  };

  const updateDiscountPackage = (
    id: string,
    field: keyof DiscountPackage,
    value: number | null
  ) => {
    setDiscountPackages(
      discountPackages.map((pkg) => (pkg.id === id ? { ...pkg, [field]: value } : pkg))
    );
  };

  const removeDiscountPackage = (id: string) => {
    setDiscountPackages(discountPackages.filter((pkg) => pkg.id !== id));
  };

  return {
    currentStep,
    setCurrentStep,
    galleryPermission,
    setGalleryPermission,
    selectedClient,
    setSelectedClient,
    isClientModalOpen,
    setIsClientModalOpen,
    useExistingPassword,
    setUseExistingPassword,
    newPassword,
    setNewPassword,
    passwordDisabled,
    setPasswordDisabled,
    savePasswordToClient,
    setSavePasswordToClient,
    sessionName,
    setSessionName,
    sessionFont,
    setSessionFont,
    titleCaseMode,
    setTitleCaseMode,
    packageName,
    setPackageName,
    includedPhotos,
    setIncludedPhotos,
    saleMode,
    setSaleMode,
    pricingModel,
    setPricingModel,
    chargeType,
    setChargeType,
    fixedPrice,
    setFixedPrice,
    discountPackages,
    setDiscountPackages,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    supabaseGalleryId,
    setSupabaseGalleryId,
    isCreatingGallery,
    setIsCreatingGallery,
    creatingGalleryRef,
    showRecreateDialog,
    setShowRecreateDialog,
    recreateConfirmed,
    setRecreateConfirmed,
    activeFolderId,
    setActiveFolderId,
    welcomeMessage,
    setWelcomeMessage,
    welcomeMessageEnabled,
    setWelcomeMessageEnabled,
    customDays,
    setCustomDays,
    imageResizeOption,
    setImageResizeOption,
    watermarkType,
    setWatermarkType,
    watermarkOpacity,
    setWatermarkOpacity,
    watermarkDisplay,
    setWatermarkDisplay,
    allowComments,
    setAllowComments,
    allowDownload,
    setAllowDownload,
    allowExtraPhotos,
    setAllowExtraPhotos,
    selectedThemeId,
    setSelectedThemeId,
    clientMode,
    setClientMode,
    userTouchedSaleModeRef,
    userTouchedImageResizeRef,
    userTouchedChargeTypeRef,
    userTouchedPricingModelRef,
    userTouchedPaymentMethodRef,
    userTouchedAllowCommentsRef,
    userTouchedAllowDownloadRef,
    userTouchedAllowExtraPhotosRef,
    userTouchedWatermarkDisplayRef,
    userTouchedClientModeRef,
    userTouchedSessionNameRef,
    userTouchedPackageNameRef,
    userTouchedTypographyRef,
    addDiscountPackage,
    updateDiscountPackage,
    removeDiscountPackage,
  };
}
