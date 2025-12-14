import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { NichoCombobox } from '@/components/onboarding/NichoCombobox';
import { CidadeIBGECombobox, CidadeIBGE } from '@/components/onboarding/CidadeIBGECombobox';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import { StepIndicator } from '@/components/auth/StepIndicator';
import { useQueryClient } from '@tanstack/react-query';
import authBackground from '@/assets/auth-background.jpg';
import lunariLogo from '@/assets/lunari-logo.png';

export default function Onboarding() {
  const { user } = useAuth();
  const { updateProfileAsync } = useUserProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: '',
    nicho: '',
    cidade: null as CidadeIBGE | null
  });

  const [errors, setErrors] = useState({
    nome: '',
    nicho: '',
    cidade: ''
  });

  const validateStep = () => {
    if (currentStep === 0) {
      // Validar nome
      const nome = formData.nome.trim();
      if (!nome) {
        setErrors(prev => ({ ...prev, nome: 'Este campo é obrigatório' }));
        return false;
      }
      if (nome.length < 2) {
        setErrors(prev => ({ ...prev, nome: 'Precisa ter pelo menos 2 caracteres' }));
        return false;
      }
      setErrors(prev => ({ ...prev, nome: '' }));
      return true;
    }

    if (currentStep === 1) {
      // Validar nicho
      if (!formData.nicho) {
        setErrors(prev => ({ ...prev, nicho: 'Selecione um nicho' }));
        return false;
      }
      setErrors(prev => ({ ...prev, nicho: '' }));
      return true;
    }

    if (currentStep === 2) {
      // Validar cidade
      if (!formData.cidade) {
        setErrors(prev => ({ ...prev, cidade: 'Selecione uma cidade' }));
        return false;
      }
      setErrors(prev => ({ ...prev, cidade: '' }));
      return true;
    }

    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (currentStep < 2) {
      setCurrentStep(prev => prev + 1);
    } else {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user || !formData.cidade) return;

    setIsLoading(true);
    try {
      // Usar mutateAsync para aguardar a conclusão
      await updateProfileAsync({
        nome: formData.nome.trim(),
        nicho: formData.nicho,
        cidade_ibge_id: formData.cidade.id,
        cidade_nome: formData.cidade.nome,
        cidade_uf: formData.cidade.uf,
        cidade: `${formData.cidade.nome} - ${formData.cidade.uf}`, // Legacy
        is_onboarding_complete: true
      });

      // Aguardar cache ser atualizado antes de navegar
      await queryClient.refetchQueries({ queryKey: ['profile', user.id] });

      toast.success('Bem-vindo(a)! 🎉');
      navigate('/');
    } catch (error) {
      console.error('Erro ao completar onboarding:', error);
      toast.error('Erro ao salvar informações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await updateProfileAsync({ is_onboarding_complete: true });
      await queryClient.refetchQueries({ queryKey: ['profile', user.id] });
      navigate('/');
    } catch (error) {
      console.error('Erro ao pular onboarding:', error);
      toast.error('Erro ao pular onboarding');
    } finally {
      setIsLoading(false);
    }
  };

  // Mapear currentStep (0-based) para StepIndicator (1-based, começando em 2)
  const stepIndicatorValue = (currentStep + 2) as 1 | 2 | 3 | 4;

  return (
    <div className="min-h-screen relative">
      {/* Barra Superior com Logo */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 p-3 md:p-4">
        <div className="container mx-auto">
          <img 
            src={lunariLogo} 
            alt="Lunari" 
            className="h-8 md:h-10 lg:h-12 object-contain" 
          />
        </div>
      </div>

      {/* Background com Gradiente */}
      <div 
        className="min-h-screen flex items-center justify-center pt-20 px-4"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#CD7F5E]/60 via-[#E89A7A]/50 to-[#CD7F5E]/60" />
        
        <Card className="relative z-10 w-full max-w-md bg-black/20 backdrop-blur-md border-white/20 shadow-2xl overflow-hidden">
          {/* Step Indicator */}
          <StepIndicator currentStep={stepIndicatorValue} />

          <CardContent className="p-6 md:p-8 space-y-6">
            {/* Step 0: Nome */}
            {currentStep === 0 && (
              <OnboardingStep
                title="Como você quer ser chamado(a)?"
                subtitle="Digite seu nome ou apelido"
                icon={User}
                value={formData.nome}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, nome: value }));
                  setErrors(prev => ({ ...prev, nome: '' }));
                }}
                placeholder="Seu nome"
                error={errors.nome}
                autoFocus
              />
            )}

            {/* Step 1: Nicho */}
            {currentStep === 1 && (
              <NichoCombobox
                value={formData.nicho}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, nicho: value }));
                  setErrors(prev => ({ ...prev, nicho: '' }));
                }}
                error={errors.nicho}
              />
            )}

            {/* Step 2: Cidade */}
            {currentStep === 2 && (
              <CidadeIBGECombobox
                value={formData.cidade}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, cidade: value }));
                  setErrors(prev => ({ ...prev, cidade: '' }));
                }}
                error={errors.cidade}
              />
            )}

            {/* Botões de Navegação */}
            <div className="flex gap-3 pt-4">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="flex-1 h-12 bg-white/10 hover:bg-white/20 text-white border border-white/30 font-light"
                >
                  Voltar
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                disabled={isLoading}
                className="flex-1 h-12 bg-[#CD7F5E] hover:bg-[#B86F4E] text-white font-light border border-white/30 shadow-sm"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : currentStep === 2 ? (
                  'Começar! 🚀'
                ) : (
                  'Continuar'
                )}
              </Button>
            </div>

            {/* Link para pular */}
            <button
              onClick={handleSkip}
              disabled={isLoading}
              className="w-full text-sm text-white/80 hover:text-white font-light transition-colors duration-150"
            >
              Pular por enquanto
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
