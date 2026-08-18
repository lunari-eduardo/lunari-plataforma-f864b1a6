import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  OnboardingService,
  BusinessData,
  PhotographyTypesData,
  BrandData,
  PricingModelChoice,
} from '@/services/OnboardingService';
import { ProfileService } from '@/services/ProfileService';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface OnboardingFormData {
  business: BusinessData;
  photographyTypes: PhotographyTypesData;
  contracts: {
    wantsContracts: boolean | null;
    selectedSlugs: string[];
  };
  forms: {
    wantsForms: boolean | null;
    selectedSlugs: string[];
  };
  brand: BrandData;
  pricing: {
    model: PricingModelChoice;
  };
}

const INITIAL_FORM_DATA: OnboardingFormData = {
  business: {
    nome: '',
    cidade: '',
    cidade_nome: '',
    cidade_uf: '',
    cidade_ibge_id: null,
    instagram: '',
    whatsapp: '',
  },
  photographyTypes: {
    mainNiche: null,
    categories: ['Gestante', 'Newborn', 'Família'],
  },
  contracts: {
    wantsContracts: null,
    selectedSlugs: ['ensaio', 'gestante', 'casamento'],
  },
  forms: {
    wantsForms: null,
    selectedSlugs: ['ensaio', 'gestante'],
  },
  brand: {
    logoUrl: null,
    brandName: '',
    instagram: '',
    brandColor: '#C6A36A',
  },
  pricing: {
    model: 'fixo',
  },
};

export const TOTAL_CONFIG_STEPS = 6; // Etapas de formulário 1 a 6

export function useOnboarding() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [formData, setFormData] = useState<OnboardingFormData>(INITIAL_FORM_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);
  const [lastSavedStep, setLastSavedStep] = useState<number | null>(null);

  const initialLoaded = useRef(false);

  // Carregar dados existentes
  useEffect(() => {
    if (!user || initialLoaded.current) return;

    const loadInitialState = async () => {
      setIsLoading(true);
      try {
        const state = await OnboardingService.getOnboardingState(user.id);

        if (state) {
          if (state.completed_steps && state.completed_steps.length > 0) {
            setCompletedSteps(state.completed_steps);
          }
          if (state.current_step > 0 && state.status === 'in_progress') {
            setLastSavedStep(state.current_step);
          }
          if (state.data && Object.keys(state.data).length > 0) {
            setFormData((prev) => ({
              ...prev,
              ...state.data,
            }));
          }
        }

        // Pré-preencher com dados do perfil se disponíveis
        if (profile) {
          setFormData((prev) => {
            const instagram = (profile.site_redes_sociais && profile.site_redes_sociais[0]) || prev.business.instagram || '';
            const whatsapp = profile.telefone || (profile.telefones && profile.telefones[0]) || prev.business.whatsapp || '';
            const nome = profile.nome || prev.business.nome || '';
            const brandName = profile.empresa || nome || prev.brand.brandName || '';

            return {
              ...prev,
              business: {
                ...prev.business,
                nome,
                cidade: profile.cidade || prev.business.cidade || '',
                cidade_nome: profile.cidade_nome || prev.business.cidade_nome || '',
                cidade_uf: profile.cidade_uf || prev.business.cidade_uf || '',
                cidade_ibge_id: profile.cidade_ibge_id || prev.business.cidade_ibge_id || null,
                instagram,
                whatsapp,
              },
              brand: {
                ...prev.brand,
                logoUrl: profile.logo_url || prev.brand.logoUrl || null,
                brandName,
                instagram: prev.brand.instagram || instagram,
              },
              photographyTypes: {
                ...prev.photographyTypes,
                mainNiche: profile.nicho || prev.photographyTypes.mainNiche,
              },
            };
          });
        }
      } catch (err) {
        console.error('Erro ao carregar estado inicial do onboarding:', err);
      } finally {
        setIsLoading(false);
        initialLoaded.current = true;
      }
    };

    loadInitialState();
  }, [user, profile]);

  // Atualizar campo específico do formData
  const updateFormData = useCallback(
    <K extends keyof OnboardingFormData>(section: K, data: Partial<OnboardingFormData[K]>) => {
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section] as any),
          ...data,
        },
      }));
    },
    []
  );

  // Sincronizar nome e instagram com a etapa da marca
  const handleBusinessChange = useCallback((data: Partial<BusinessData>) => {
    setFormData((prev) => {
      const newBusiness = { ...prev.business, ...data };
      const newBrand = { ...prev.brand };

      // Se o usuário ainda não personalizou o nome da marca, mantém sincronizado com o nome profissional
      if (data.nome && (!prev.brand.brandName || prev.brand.brandName === prev.business.nome)) {
        newBrand.brandName = data.nome;
      }
      // Se o usuário ainda não personalizou o instagram da marca, mantém sincronizado
      if (data.instagram && (!prev.brand.instagram || prev.brand.instagram === prev.business.instagram)) {
        newBrand.instagram = data.instagram;
      }

      return {
        ...prev,
        business: newBusiness,
        brand: newBrand,
      };
    });
  }, []);

  // Upload de Logomarca
  const uploadLogo = useCallback(
    async (file: File) => {
      if (!user) return;
      setIsUploadingLogo(true);
      try {
        const url = await ProfileService.uploadLogo(user.id, file);
        setFormData((prev) => ({
          ...prev,
          brand: {
            ...prev.brand,
            logoUrl: url,
          },
        }));
        toast.success('Logomarca enviada com sucesso!');
        return url;
      } catch (e: any) {
        console.error('Erro ao fazer upload da logomarca:', e);
        toast.error(e.message || 'Erro ao enviar a logomarca');
        throw e;
      } finally {
        setIsUploadingLogo(false);
      }
    },
    [user]
  );

  // Remover Logomarca
  const removeLogo = useCallback(async () => {
    if (!user) return;
    setIsUploadingLogo(true);
    try {
      await ProfileService.deleteLogo(user.id, formData.brand.logoUrl);
      setFormData((prev) => ({
        ...prev,
        brand: {
          ...prev.brand,
          logoUrl: null,
        },
      }));
      toast.success('Logomarca removida.');
    } catch (e) {
      console.error('Erro ao remover logo:', e);
      toast.error('Erro ao remover logomarca');
    } finally {
      setIsUploadingLogo(false);
    }
  }, [user, formData.brand.logoUrl]);

  // Salvar a etapa atual no backend
  const saveCurrentStep = useCallback(
    async (stepToSave: number) => {
      if (!user) return;

      setIsSaving(true);
      try {
        switch (stepToSave) {
          case 1:
            await OnboardingService.saveBusinessProfile(user.id, formData.business);
            break;
          case 2:
            await OnboardingService.savePhotographyTypes(user.id, formData.photographyTypes);
            break;
          case 3:
            if (formData.contracts.wantsContracts) {
              await OnboardingService.seedContracts(user.id, formData.contracts.selectedSlugs);
            }
            break;
          case 4:
            if (formData.forms.wantsForms) {
              await OnboardingService.seedForms(user.id, formData.forms.selectedSlugs);
            }
            break;
          case 5:
            await OnboardingService.saveBrandIdentity(user.id, formData.brand);
            break;
          case 6:
            await OnboardingService.savePricingModel(user.id, formData.pricing.model);
            break;
          default:
            break;
        }

        const newCompleted = Array.from(new Set([...completedSteps, stepToSave]));
        setCompletedSteps(newCompleted);

        await OnboardingService.saveOnboardingState(user.id, {
          current_step: stepToSave + 1,
          completed_steps: newCompleted,
          status: 'in_progress',
          data: formData,
        });
      } catch (err: any) {
        console.error(`Erro ao salvar etapa ${stepToSave}:`, err);
        toast.error('Erro ao salvar etapa. Tente novamente.');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [user, formData, completedSteps]
  );

  // Avançar para a próxima etapa
  const nextStep = useCallback(async () => {
    // Validação básica por etapa antes de salvar
    if (currentStep === 1) {
      if (!formData.business.nome.trim()) {
        toast.error('Informe o nome profissional');
        return;
      }
      if (!formData.business.cidade.trim()) {
        toast.error('Informe a sua cidade');
        return;
      }
    }

    if (currentStep === 2) {
      if (!formData.photographyTypes.categories || formData.photographyTypes.categories.length === 0) {
        toast.error('Selecione pelo menos um tipo de fotografia');
        return;
      }
    }

    if (currentStep > 0 && currentStep <= 6) {
      try {
        await saveCurrentStep(currentStep);
      } catch {
        return; // interrompe se falhar o salvamento
      }
    }

    if (currentStep < 7) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep, formData, saveCurrentStep]);

  // Voltar etapa
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  // Ir direto a uma etapa
  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Retomar onde parou
  const resumeWhereLeft = useCallback(() => {
    if (lastSavedStep && lastSavedStep > 0 && lastSavedStep <= 7) {
      setCurrentStep(lastSavedStep);
    } else {
      setCurrentStep(1);
    }
  }, [lastSavedStep]);

  // Finalizar Onboarding
  const finishOnboarding = useCallback(async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await OnboardingService.completeOnboarding(user.id);
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast.success('Bem-vindo(a) ao Lunari! 🎉');
      window.location.href = '/app';
    } catch (e) {
      console.error('Erro ao finalizar onboarding:', e);
      toast.error('Erro ao concluir configuração.');
    } finally {
      setIsSaving(false);
    }
  }, [user, queryClient]);

  // Adiar Onboarding ("Configurar depois")
  const skipOnboarding = useCallback(async () => {
    if (!user) return;
    try {
      await OnboardingService.skipOnboarding(user.id);
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      window.location.href = '/app';
    } catch (e) {
      console.error('Erro ao adiar onboarding:', e);
      window.location.href = '/app';
    }
  }, [user, queryClient]);

  return {
    currentStep,
    completedSteps,
    formData,
    isLoading: isLoading || profileLoading,
    isSaving,
    isUploadingLogo,
    lastSavedStep,
    updateFormData,
    handleBusinessChange,
    uploadLogo,
    removeLogo,
    nextStep,
    prevStep,
    goToStep,
    resumeWhereLeft,
    finishOnboarding,
    skipOnboarding,
  };
}
