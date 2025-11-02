import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import { StepIndicator } from '@/components/auth/StepIndicator';
import authBackground from '@/assets/auth-background.jpg';
import lunariLogo from '@/assets/lunari-logo.png';

export default function Onboarding() {
  const { user } = useAuth();
  const { updateProfile } = useUserProfile();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: '',
    cidade: ''
  });

  const [errors, setErrors] = useState({
    nome: '',
    cidade: ''
  });

  const steps = [
    {
      title: 'Como você quer ser chamado(a)?',
      subtitle: 'Digite seu nome ou apelido',
      icon: User,
      field: 'nome' as const,
      placeholder: 'Seu nome',
      autoFocus: true
    },
    {
      title: 'Onde você mora?',
      subtitle: 'Sua cidade ajuda a personalizar sua experiência',
      icon: MapPin,
      field: 'cidade' as const,
      placeholder: 'Sua cidade',
      autoFocus: true
    }
  ];

  const currentStepConfig = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const validateStep = () => {
    const field = currentStepConfig.field;
    const value = formData[field].trim();

    if (!value) {
      setErrors(prev => ({
        ...prev,
        [field]: 'Este campo é obrigatório'
      }));
      return false;
    }

    if (value.length < 2) {
      setErrors(prev => ({
        ...prev,
        [field]: 'Precisa ter pelo menos 2 caracteres'
      }));
      return false;
    }

    setErrors(prev => ({ ...prev, [field]: '' }));
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Usar mutation do React Query que invalida cache automaticamente
      await updateProfile({
        nome: formData.nome.trim(),
        cidade: formData.cidade.trim(),
        is_onboarding_complete: true
      });

      // Aguardar um momento para o cache ser invalidado
      await new Promise(resolve => setTimeout(resolve, 300));

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
      await updateProfile({ is_onboarding_complete: true });
      await new Promise(resolve => setTimeout(resolve, 300));
      navigate('/');
    } catch (error) {
      console.error('Erro ao pular onboarding:', error);
      toast.error('Erro ao pular onboarding');
    } finally {
      setIsLoading(false);
    }
  };

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
          {/* Step Indicator - Etapa 2 (Nome) ou Etapa 3 (Cidade) */}
          <StepIndicator currentStep={currentStep === 0 ? 2 : 3} />

          <CardContent className="p-6 md:p-8 space-y-6">
            <OnboardingStep
              title={currentStepConfig.title}
              subtitle={currentStepConfig.subtitle}
              icon={currentStepConfig.icon}
              value={formData[currentStepConfig.field]}
              onChange={(value) => {
                setFormData(prev => ({
                  ...prev,
                  [currentStepConfig.field]: value
                }));
                setErrors(prev => ({ ...prev, [currentStepConfig.field]: '' }));
              }}
              placeholder={currentStepConfig.placeholder}
              error={errors[currentStepConfig.field]}
              autoFocus={currentStepConfig.autoFocus}
            />

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
                ) : currentStep === steps.length - 1 ? (
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
