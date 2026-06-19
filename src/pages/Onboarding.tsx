import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Loader2 } from 'lucide-react';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { NichoCombobox } from '@/components/onboarding/NichoCombobox';
import { CidadeIBGECombobox, CidadeIBGE } from '@/components/onboarding/CidadeIBGECombobox';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import { StepIndicator } from '@/components/auth/StepIndicator';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import loginBackground from '@/assets/auth/login-background.jpg';

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
    cidade: null as CidadeIBGE | null,
  });

  const [errors, setErrors] = useState({ nome: '', nicho: '', cidade: '' });

  const validateStep = () => {
    if (currentStep === 0) {
      const nome = formData.nome.trim();
      if (!nome) {
        setErrors((p) => ({ ...p, nome: 'Este campo é obrigatório' }));
        return false;
      }
      if (nome.length < 2) {
        setErrors((p) => ({ ...p, nome: 'Precisa ter pelo menos 2 caracteres' }));
        return false;
      }
      setErrors((p) => ({ ...p, nome: '' }));
      return true;
    }
    if (currentStep === 1) {
      if (!formData.nicho) {
        setErrors((p) => ({ ...p, nicho: 'Selecione um nicho' }));
        return false;
      }
      setErrors((p) => ({ ...p, nicho: '' }));
      return true;
    }
    if (currentStep === 2) {
      if (!formData.cidade) {
        setErrors((p) => ({ ...p, cidade: 'Selecione uma cidade' }));
        return false;
      }
      setErrors((p) => ({ ...p, cidade: '' }));
      return true;
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (currentStep < 2) setCurrentStep((p) => p + 1);
    else await handleComplete();
  };

  const handleComplete = async () => {
    if (!user || !formData.cidade) return;
    setIsLoading(true);
    try {
      await updateProfileAsync({
        nome: formData.nome.trim(),
        nicho: formData.nicho,
        cidade_ibge_id: formData.cidade.id,
        cidade_nome: formData.cidade.nome,
        cidade_uf: formData.cidade.uf,
        cidade: `${formData.cidade.nome} - ${formData.cidade.uf}`,
        is_onboarding_complete: true,
      });

      const { error: trialError } = await supabase.rpc('start_studio_trial');
      if (trialError) console.error('Trial start error:', trialError);

      await queryClient.refetchQueries({ queryKey: ['profile', user.id] });
      toast.success('Bem-vindo(a)! 🎉');
      window.location.href = '/app';
    } catch (error) {
      console.error('Erro ao completar onboarding:', error);
      toast.error('Erro ao salvar informações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((p) => p - 1);
  };

  const stepIndicatorValue = (currentStep + 2) as 1 | 2 | 3 | 4;

  return (
    <div
      className="dark min-h-[100dvh] w-full relative bg-[#0a0a0a] flex items-center justify-center px-6 py-10"
      style={{
        backgroundImage: `url(${loginBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay para legibilidade */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70 pointer-events-none" />

      {/* Modal vidro escuro */}
      <div
        className="relative z-10 w-full max-w-[440px] rounded-2xl
                   bg-[#0a0a0a]/70 backdrop-blur-xl
                   border border-white/10
                   shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]
                   p-6 md:p-8 space-y-6
                   animate-in fade-in zoom-in-95 duration-300
                   motion-reduce:animate-none"
      >
        <StepIndicator currentStep={stepIndicatorValue} />

        <div className="space-y-6">
          {currentStep === 0 && (
            <OnboardingStep
              title="Como você quer ser chamado(a)?"
              subtitle="Digite seu nome ou apelido"
              icon={User}
              value={formData.nome}
              onChange={(value) => {
                setFormData((p) => ({ ...p, nome: value }));
                setErrors((p) => ({ ...p, nome: '' }));
              }}
              placeholder="Seu nome"
              error={errors.nome}
              autoFocus
            />
          )}

          {currentStep === 1 && (
            <NichoCombobox
              value={formData.nicho}
              onChange={(value) => {
                setFormData((p) => ({ ...p, nicho: value }));
                setErrors((p) => ({ ...p, nicho: '' }));
              }}
              error={errors.nicho}
            />
          )}

          {currentStep === 2 && (
            <CidadeIBGECombobox
              value={formData.cidade}
              onChange={(value) => {
                setFormData((p) => ({ ...p, cidade: value }));
                setErrors((p) => ({ ...p, cidade: '' }));
              }}
              error={errors.cidade}
            />
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isLoading}
                className="flex-1 h-12 rounded-xl text-sm font-light text-white/80
                           bg-white/[0.04] hover:bg-white/[0.08]
                           border border-white/10 hover:border-white/20
                           transition-all duration-150
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C97A4A]/60
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Voltar
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={isLoading}
              aria-busy={isLoading}
              className="flex-1 h-12 rounded-xl text-sm font-medium text-white
                         bg-gradient-to-b from-[#C97A4A] to-[#A8633A]
                         hover:from-[#D4845A] hover:to-[#B66E40]
                         active:scale-[0.99]
                         shadow-[0_8px_24px_-8px_rgba(201,122,74,0.6)]
                         transition-all duration-150
                         flex items-center justify-center gap-2
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C97A4A]/60
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : currentStep === 2 ? (
                'Começar 🚀'
              ) : (
                'Continuar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
