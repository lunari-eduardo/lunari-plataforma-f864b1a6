import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  GalleryPermission,
  Client,
  SaleMode,
  PricingModel,
  ChargeType,
  DiscountPackage,
  SaleSettings,
  PaymentMethod,
  TitleCaseMode,
  ImageResizeOption,
  WatermarkType,
  WatermarkDisplay,
} from '@/types/gallery';
import { RegrasCongeladas, getFaixasFromRegras } from '@/lib/pricingUtils';
import { resolveAssistedExtraPrice } from '../pricingHelpers';
import { resolveFinalPricingAndRules, buildGalleryConfig } from '../payloadHelper';
import { PriorDeletion } from './useAssistedSession';

interface UseGallerySubmitProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  supabaseGalleryId: string | null;
  setSupabaseGalleryId: (id: string | null) => void;
  creatingGalleryRef: React.MutableRefObject<boolean>;
  isCreatingGallery: boolean;
  setIsCreatingGallery: (isCreating: boolean) => void;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  galleryPermission: GalleryPermission;
  passwordDisabled: boolean;
  useExistingPassword: boolean;
  newPassword: string;
  savePasswordToClient: boolean;
  selectedClient: Client | null;
  sessionName: string;
  packageName: string;
  includedPhotos: number;
  customDays: number;
  saleMode: SaleMode;
  pricingModel: PricingModel;
  chargeType: ChargeType;
  fixedPrice: number;
  discountPackages: DiscountPackage[];
  regrasCongeladas: RegrasCongeladas | null;
  overridePricing: boolean;
  isAssistedMode: boolean;
  regrasLoaded: boolean;
  gestaoParams: any;
  welcomeMessage: string;
  watermarkType: WatermarkType;
  watermarkOpacity: number;
  watermarkDisplay: WatermarkDisplay;
  imageResizeOption: ImageResizeOption;
  allowComments: boolean;
  allowDownload: boolean;
  allowExtraPhotos: boolean;
  selectedThemeId?: string;
  clientMode: 'light' | 'dark';
  sessionFont: string;
  titleCaseMode: TitleCaseMode;
  getEffectivePaymentMethod: () => PaymentMethod | null;
  getSaleSettings: () => SaleSettings;
  photoManager: { isUploadingPhotos: boolean; uploadErrorCount: number };
  priorDeletion: PriorDeletion | null;
  recreateConfirmed: boolean;
  setShowRecreateDialog: (show: boolean) => void;
  updateClient: (id: string, data: any) => Promise<any>;
  createSupabaseGallery: any;
  updateGallery: any;
  publishSupabaseGallery: any;
  updateSettings: (settings: any) => void;
  navigate: (path: string) => void;
}

export function useGallerySubmit({
  currentStep,
  setCurrentStep,
  supabaseGalleryId,
  setSupabaseGalleryId,
  creatingGalleryRef,
  isCreatingGallery,
  setIsCreatingGallery,
  activeFolderId,
  setActiveFolderId,
  galleryPermission,
  passwordDisabled,
  useExistingPassword,
  newPassword,
  savePasswordToClient,
  selectedClient,
  sessionName,
  packageName,
  includedPhotos,
  customDays,
  saleMode,
  pricingModel,
  chargeType,
  fixedPrice,
  discountPackages,
  regrasCongeladas,
  overridePricing,
  isAssistedMode,
  regrasLoaded,
  gestaoParams,
  welcomeMessage,
  watermarkType,
  watermarkOpacity,
  watermarkDisplay,
  imageResizeOption,
  allowComments,
  allowDownload,
  allowExtraPhotos,
  selectedThemeId,
  clientMode,
  sessionFont,
  titleCaseMode,
  getEffectivePaymentMethod,
  getSaleSettings,
  photoManager,
  priorDeletion,
  recreateConfirmed,
  setShowRecreateDialog,
  updateClient,
  createSupabaseGallery,
  updateGallery,
  publishSupabaseGallery,
  updateSettings,
  navigate,
}: UseGallerySubmitProps) {
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const getResolvedPricing = () =>
    resolveFinalPricingAndRules({
      regrasCongeladas,
      overridePricing,
      sessionId: gestaoParams?.session_id,
      precoDaFotoExtraUrl: gestaoParams?.preco_da_foto_extra,
      saleMode,
      pricingModel,
      fixedPrice,
      discountPackages,
      includedPhotos,
      packageName,
      allowExtraPhotos,
    });

  const getConfig = () =>
    buildGalleryConfig({
      watermarkType,
      watermarkOpacity,
      watermarkDisplay,
      imageResizeOption,
      allowComments,
      allowDownload,
      allowExtraPhotos,
      saleSettings: getSaleSettings(),
      themeId: selectedThemeId,
      clientMode,
      sessionFont,
      titleCaseMode,
    });

  const createSupabaseGalleryForUploads = async (): Promise<boolean> => {
    if (galleryPermission === 'private' && !selectedClient) {
      toast.error('Selecione um cliente para galeria privada');
      return false;
    }
    if (!sessionName.trim()) {
      toast.error('Informe o nome da sessão para continuar.');
      return false;
    }
    if (supabaseGalleryId) return true;
    if (creatingGalleryRef.current) return false;
    creatingGalleryRef.current = true;
    setIsCreatingGallery(true);
    try {
      let passwordToUse: string | undefined = undefined;
      if (galleryPermission === 'private' && !passwordDisabled) {
        if (useExistingPassword && selectedClient?.galleryPassword) {
          passwordToUse = selectedClient.galleryPassword;
        } else if (newPassword) {
          passwordToUse = newPassword;
          if (savePasswordToClient && selectedClient) {
            try {
              await updateClient(selectedClient.id, { galleryPassword: newPassword });
            } catch (error) {
              console.error('Error saving password to client:', error);
            }
          }
        }
      }

      const clientName = selectedClient?.name || 'Galeria Pública';
      const clientEmail = selectedClient?.email || '';
      const hasSessionId = !!gestaoParams?.session_id;
      const { valorFotoExtraFinal, finalRegrasCongeladas } = getResolvedPricing();

      if (saleMode !== 'no_sale' && allowExtraPhotos && valorFotoExtraFinal <= 0) {
        toast.error(
          'O valor da foto extra não pode ser R$ 0,00 quando a venda de fotos extras está ativa. Defina o valor na etapa de Venda.'
        );
        return false;
      }

      const result = await createSupabaseGallery({
        clienteId: selectedClient?.id || null,
        clienteNome: clientName,
        clienteEmail: clientEmail,
        nomeSessao: sessionName.trim(),
        nomePacote: packageName,
        fotosIncluidas: includedPhotos,
        valorFotoExtra: saleMode !== 'no_sale' ? valorFotoExtraFinal : 0,
        prazoSelecaoDias: customDays,
        permissao: galleryPermission,
        mensagemBoasVindas: welcomeMessage,
        galleryPassword: passwordToUse,
        sessionId: hasSessionId ? gestaoParams.session_id : null,
        origin: hasSessionId ? 'gestao' : 'manual',
        regrasCongeladas: finalRegrasCongeladas,
        venda_modo: saleMode,
        venda_pagamento_provedor: getEffectivePaymentMethod(),
        venda_tipo_cobranca: chargeType,
        configuracoes: getConfig(),
      });

      if (result?.id) {
        setSupabaseGalleryId(result.id);
        try {
          const {
            data: { user: currentUser },
          } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: existingFolders } = await supabase
              .from('galeria_pastas')
              .select('id')
              .eq('galeria_id', result.id)
              .order('ordem', { ascending: true })
              .limit(1);

            if (existingFolders && existingFolders.length > 0) {
              setActiveFolderId(existingFolders[0].id);
            } else {
              const folderName = sessionName?.trim() || 'Todas as fotos';
              const { data: folder } = await supabase
                .from('galeria_pastas')
                .insert({
                  galeria_id: result.id,
                  user_id: currentUser.id,
                  nome: folderName,
                  ordem: 0,
                })
                .select()
                .single();
              if (folder) {
                setActiveFolderId(folder.id);
              }
            }
          }
        } catch (err) {
          console.error('Error creating default folder:', err);
        }
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error creating gallery:', error);
      toast.error(error?.message || 'Erro ao criar galeria para upload');
      return false;
    } finally {
      setIsCreatingGallery(false);
      creatingGalleryRef.current = false;
    }
  };

  const handleNext = async () => {
    if (isAdvancing || isSavingDraft || isGoingBack) return;
    setIsAdvancing(true);
    try {
      if (currentStep < 6) {
        if (currentStep === 2 && saleMode !== 'no_sale') {
          const hasSessionRegras = regrasCongeladas && !overridePricing;
          const resolved = hasSessionRegras
            ? resolveAssistedExtraPrice(regrasCongeladas, gestaoParams?.preco_da_foto_extra)
            : null;
          const effectiveExtraPrice =
            resolved && resolved.valor > 0 ? resolved.valor : fixedPrice;
          const hasFaixas =
            (regrasCongeladas && getFaixasFromRegras(regrasCongeladas).length > 0) ||
            (pricingModel === 'packages' && discountPackages.length > 0);

          if (effectiveExtraPrice <= 0 && !hasFaixas) {
            toast.error('Informe um valor de foto extra maior que R$ 0,00 para continuar.');
            return;
          }
        }

        if (currentStep === 3 && !supabaseGalleryId) {
          if (galleryPermission === 'private' && !selectedClient) {
            toast.error('Selecione um cliente primeiro');
            setCurrentStep(1);
            return;
          }
          if (isAssistedMode && !regrasLoaded) return;
          if (creatingGalleryRef.current) return;
          if (priorDeletion && !recreateConfirmed) {
            setShowRecreateDialog(true);
            return;
          }
          const ok = await createSupabaseGalleryForUploads();
          if (!ok) return;
        }

        if (currentStep === 4) {
          if (photoManager.isUploadingPhotos) {
            toast.error('Aguarde finalizar os uploads antes de prosseguir.');
            return;
          }
          if (photoManager.uploadErrorCount > 0) {
            toast.error(
              `Existem ${photoManager.uploadErrorCount} arquivo(s) com erro. Reenvie ou remova antes de prosseguir.`
            );
            return;
          }
        }

        setCurrentStep(currentStep + 1);
      } else {
        if (supabaseGalleryId) {
          try {
            const { valorFotoExtraFinal, finalRegrasCongeladas } = getResolvedPricing();

            await updateGallery({
              id: supabaseGalleryId,
              data: {
                configuracoes: getConfig(),
                mensagemBoasVindas: welcomeMessage,
                prazoSelecaoDias: customDays,
                valorFotoExtra: saleMode !== 'no_sale' ? valorFotoExtraFinal : 0,
                venda_modo: saleMode,
                venda_pagamento_provedor: getEffectivePaymentMethod(),
                venda_tipo_cobranca: chargeType,
                ...(finalRegrasCongeladas && {
                  regrasCongeladas: finalRegrasCongeladas,
                }),
              },
            });

            updateSettings({ lastSessionFont: sessionFont });
            await publishSupabaseGallery(supabaseGalleryId);
            navigate(`/app/gallery/select/${supabaseGalleryId}`);
          } catch (error) {
            console.error('Error finalizing gallery:', error);
            toast.error('Erro ao finalizar galeria');
          }
          return;
        }
        toast.error('Erro ao criar galeria. Tente novamente.');
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleBack = () => {
    if (isAdvancing || isSavingDraft || isGoingBack) return;
    setIsGoingBack(true);
    setTimeout(() => setIsGoingBack(false), 200);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/app/gallery/list');
    }
  };

  const handleSaveDraft = async () => {
    if (isAdvancing || isSavingDraft || isGoingBack) return;
    if (!sessionName.trim()) {
      toast.error('Informe o nome da sessão para salvar o rascunho.');
      return;
    }
    setIsSavingDraft(true);
    try {
      updateSettings({ lastSessionFont: sessionFont });
      let passwordToUse: string | undefined = undefined;
      if (galleryPermission === 'private' && !passwordDisabled && selectedClient) {
        if (useExistingPassword && selectedClient?.galleryPassword) {
          passwordToUse = selectedClient.galleryPassword;
        } else if (newPassword) {
          passwordToUse = newPassword;
        }
      }

      const { valorFotoExtraFinal, finalRegrasCongeladas } = getResolvedPricing();

      if (supabaseGalleryId) {
        await updateGallery({
          id: supabaseGalleryId,
          data: {
            nomeSessao: sessionName.trim(),
            nomePacote: packageName || undefined,
            clienteNome: selectedClient?.name,
            clienteEmail: selectedClient?.email,
            fotosIncluidas: includedPhotos,
            valorFotoExtra: saleMode !== 'no_sale' ? valorFotoExtraFinal : 0,
            prazoSelecaoDias: customDays,
            permissao: galleryPermission,
            mensagemBoasVindas: welcomeMessage,
            configuracoes: getConfig(),
            venda_modo: saleMode,
            venda_pagamento_provedor: getEffectivePaymentMethod(),
            venda_tipo_cobranca: chargeType,
            ...(finalRegrasCongeladas && {
              regrasCongeladas: finalRegrasCongeladas,
            }),
          },
        });
        navigate('/app/gallery/list');
      } else {
        const hasSessionId = !!gestaoParams?.session_id;
        const result = await createSupabaseGallery({
          clienteId: selectedClient?.id || null,
          clienteNome: selectedClient?.name || undefined,
          clienteEmail: selectedClient?.email || undefined,
          nomeSessao: sessionName.trim(),
          nomePacote: packageName || undefined,
          fotosIncluidas: includedPhotos,
          valorFotoExtra: saleMode !== 'no_sale' ? valorFotoExtraFinal : 0,
          prazoSelecaoDias: customDays,
          permissao: galleryPermission,
          mensagemBoasVindas: welcomeMessage,
          galleryPassword: passwordToUse,
          sessionId: hasSessionId ? gestaoParams.session_id : null,
          origin: hasSessionId ? 'gestao' : 'manual',
          regrasCongeladas: finalRegrasCongeladas,
          configuracoes: getConfig(),
          venda_modo: saleMode,
          venda_pagamento_provedor: getEffectivePaymentMethod(),
          venda_tipo_cobranca: chargeType,
        });
        if (result?.id) {
          navigate('/app/gallery/list');
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Erro ao salvar rascunho');
    } finally {
      setIsSavingDraft(false);
    }
  };

  return {
    isAdvancing,
    isGoingBack,
    isSavingDraft,
    createSupabaseGalleryForUploads,
    handleNext,
    handleBack,
    handleSaveDraft,
  };
}
