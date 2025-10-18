import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

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
    <div className="min-h-screen bg-gradient-to-br from-lunar-bg via-lunar-bg to-lunar-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-lunar-muted">
            Passo {currentStep + 1} de {steps.length}
          </p>
        </div>

        {/* Card Principal */}
        <Card className="p-8 shadow-xl border-lunar-border/50 backdrop-blur-sm">
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
          <div className="flex gap-3 mt-8">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isLoading}
                className="flex-1"
              >
                Voltar
              </Button>
            )}
            
            <Button
              onClick={handleNext}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                'Salvando...'
              ) : currentStep === steps.length - 1 ? (
                'Começar! 🚀'
              ) : (
                'Continuar'
              )}
            </Button>
          </div>

          {/* Link para pular */}
          {currentStep === 0 && (
            <button
              onClick={handleSkip}
              className="w-full text-center text-sm text-lunar-muted hover:text-lunar-text mt-4 transition-colors"
            >
              Pular por enquanto
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
