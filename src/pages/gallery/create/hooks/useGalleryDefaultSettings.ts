import { useEffect, MutableRefObject } from 'react';
import {
  GalleryPermission,
  SaleMode,
  PricingModel,
  ChargeType,
  PaymentMethod,
  ImageResizeOption,
  WatermarkType,
  WatermarkDisplay,
} from '@/types/gallery';

interface UseGalleryDefaultSettingsProps {
  settings: any;
  gestaoParams: any;
  watermarkGlobalSettings: any;
  paymentData: any;
  selectedPaymentMethod: PaymentMethod | null;
  setSelectedPaymentMethod: (m: PaymentMethod) => void;
  setCustomDays: (d: number) => void;
  setGalleryPermission: (p: GalleryPermission) => void;
  setSelectedThemeId: (id: string | undefined) => void;
  setClientMode: (m: 'light' | 'dark') => void;
  setSessionFont: (f: string) => void;
  setWelcomeMessageEnabled: (e: boolean) => void;
  setWelcomeMessage: (m: string) => void;
  setSaleMode: (m: SaleMode) => void;
  setImageResizeOption: (o: ImageResizeOption) => void;
  setChargeType: (c: ChargeType) => void;
  setPricingModel: (p: PricingModel) => void;
  setAllowComments: (a: boolean) => void;
  setAllowDownload: (a: boolean) => void;
  setAllowExtraPhotos: (a: boolean) => void;
  setWatermarkDisplay: (w: WatermarkDisplay) => void;
  setWatermarkType: (t: WatermarkType) => void;
  setWatermarkOpacity: (o: number) => void;
  userTouchedClientModeRef: MutableRefObject<boolean>;
  userTouchedTypographyRef: MutableRefObject<boolean>;
  userTouchedSaleModeRef: MutableRefObject<boolean>;
  userTouchedImageResizeRef: MutableRefObject<boolean>;
  userTouchedChargeTypeRef: MutableRefObject<boolean>;
  userTouchedPricingModelRef: MutableRefObject<boolean>;
  userTouchedAllowCommentsRef: MutableRefObject<boolean>;
  userTouchedAllowDownloadRef: MutableRefObject<boolean>;
  userTouchedAllowExtraPhotosRef: MutableRefObject<boolean>;
  userTouchedWatermarkDisplayRef: MutableRefObject<boolean>;
  userTouchedPaymentMethodRef: MutableRefObject<boolean>;
}

export function useGalleryDefaultSettings({
  settings,
  gestaoParams,
  watermarkGlobalSettings,
  paymentData,
  selectedPaymentMethod,
  setSelectedPaymentMethod,
  setCustomDays,
  setGalleryPermission,
  setSelectedThemeId,
  setClientMode,
  setSessionFont,
  setWelcomeMessageEnabled,
  setWelcomeMessage,
  setSaleMode,
  setImageResizeOption,
  setChargeType,
  setPricingModel,
  setAllowComments,
  setAllowDownload,
  setAllowExtraPhotos,
  setWatermarkDisplay,
  setWatermarkType,
  setWatermarkOpacity,
  userTouchedClientModeRef,
  userTouchedTypographyRef,
  userTouchedSaleModeRef,
  userTouchedImageResizeRef,
  userTouchedChargeTypeRef,
  userTouchedPricingModelRef,
  userTouchedAllowCommentsRef,
  userTouchedAllowDownloadRef,
  userTouchedAllowExtraPhotosRef,
  userTouchedWatermarkDisplayRef,
  userTouchedPaymentMethodRef,
}: UseGalleryDefaultSettingsProps) {
  useEffect(() => {
    if (settings) {
      setCustomDays(settings.defaultExpirationDays || 10);
      setGalleryPermission(settings.defaultGalleryPermission || 'private');
      if (settings.activeThemeId) {
        setSelectedThemeId(settings.activeThemeId);
      }
      if (!userTouchedClientModeRef.current) {
        if (settings.clientTheme === 'dark') {
          setClientMode('dark');
        } else if (settings.clientTheme === 'light') {
          setClientMode('light');
        } else if (settings.customTheme?.backgroundMode === 'dark') {
          setClientMode('dark');
        } else if (settings.customTheme?.backgroundMode === 'light') {
          setClientMode('light');
        } else {
          setClientMode('light');
        }
      }
      if (settings.lastSessionFont && !userTouchedTypographyRef.current) {
        setSessionFont(settings.lastSessionFont);
      }
      const globalEnabled = settings.welcomeMessageEnabled ?? true;
      setWelcomeMessageEnabled(globalEnabled);
      if (globalEnabled && settings.defaultWelcomeMessage) {
        setWelcomeMessage(settings.defaultWelcomeMessage);
      } else if (!globalEnabled) {
        setWelcomeMessage('');
      }
      if (
        !userTouchedSaleModeRef.current &&
        !gestaoParams?.modelo_de_cobranca &&
        settings.defaultSaleMode
      ) {
        setSaleMode(settings.defaultSaleMode);
      }
      if (!userTouchedImageResizeRef.current && settings.defaultImageResize) {
        setImageResizeOption(settings.defaultImageResize);
      }
      if (!userTouchedChargeTypeRef.current && settings.defaultChargeType) {
        setChargeType(settings.defaultChargeType);
      }
      if (
        !userTouchedPricingModelRef.current &&
        !gestaoParams?.modelo_de_preco &&
        settings.defaultPricingModel
      ) {
        setPricingModel(settings.defaultPricingModel);
      }
      if (!userTouchedAllowCommentsRef.current && settings.defaultAllowComments !== undefined) {
        setAllowComments(settings.defaultAllowComments);
      }
      if (!userTouchedAllowDownloadRef.current && settings.defaultAllowDownload !== undefined) {
        setAllowDownload(settings.defaultAllowDownload);
      }
      if (!userTouchedAllowExtraPhotosRef.current && settings.defaultAllowExtraPhotos !== undefined) {
        setAllowExtraPhotos(settings.defaultAllowExtraPhotos);
      }
      if (!userTouchedWatermarkDisplayRef.current && settings.defaultWatermarkDisplay) {
        setWatermarkDisplay(settings.defaultWatermarkDisplay);
      }
    }
  }, [settings, gestaoParams?.modelo_de_cobranca, gestaoParams?.modelo_de_preco]);

  useEffect(() => {
    const modeToType: Record<string, WatermarkType> = {
      system: 'standard',
      custom: 'custom',
      none: 'none',
    };
    setWatermarkType(modeToType[watermarkGlobalSettings.mode] || 'standard');
    setWatermarkOpacity(watermarkGlobalSettings.opacity);
  }, [watermarkGlobalSettings]);

  useEffect(() => {
    if (userTouchedPaymentMethodRef.current || selectedPaymentMethod) return;
    if (settings?.defaultPaymentMethod) {
      setSelectedPaymentMethod(settings.defaultPaymentMethod);
    } else if (paymentData?.defaultIntegration) {
      setSelectedPaymentMethod(paymentData.defaultIntegration.provedor as PaymentMethod);
    }
  }, [paymentData?.defaultIntegration, selectedPaymentMethod, settings?.defaultPaymentMethod]);
}
