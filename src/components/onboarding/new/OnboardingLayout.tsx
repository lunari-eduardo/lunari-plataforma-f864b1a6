import React from 'react';
import loginBackground from '@/assets/auth/login-background.jpg';
import { ArrowLeft, Loader2, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOTAL_CONFIG_STEPS } from '@/hooks/useOnboarding';

interface OnboardingLayoutProps {
  currentStep: number;
  isSaving: boolean;
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  nextButtonLabel?: string;
  isNextDisabled?: boolean;
  hideFooterActions?: boolean;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function OnboardingLayout({
  currentStep,
  isSaving,
  onBack,
  onNext,
  onSkip,
  nextButtonLabel = 'Continuar',
  isNextDisabled = false,
  hideFooterActions = false,
  children,
  maxWidthClass = 'max-w-xl',
}: OnboardingLayoutProps) {
  const isFormStep = currentStep >= 1 && currentStep <= TOTAL_CONFIG_STEPS;
  const progressPercent = isFormStep
    ? ((currentStep - 1) / TOTAL_CONFIG_STEPS) * 100
    : currentStep === TOTAL_CONFIG_STEPS + 1
    ? 100
    : 0;

  return (
    <div
      className="dark min-h-[100dvh] w-full relative bg-[#0a0a0a] flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 overflow-x-hidden selection:bg-[#C6A36A]/30"
      style={{
        backgroundImage: `url(${loginBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay escuro com vinheta para contraste e elegância */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 pointer-events-none" />

      {/* Container Principal */}
      <div
        className={cn(
          'relative z-10 w-full rounded-[28px]',
          'bg-[#121212]/92 backdrop-blur-2xl',
          'border border-white/10',
          'shadow-[0_24px_70px_rgba(0,0,0,0.85)]',
          'p-6 sm:p-8 md:p-10',
          'animate-in fade-in zoom-in-[0.98] duration-300',
          'transition-all duration-300 flex flex-col',
          maxWidthClass
        )}
      >
        {/* Barra de Progresso e Indicador (apenas nas etapas de formulário 1 a 6) */}
        {isFormStep && (
          <div className="mb-8 space-y-3">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span className="font-medium tracking-wide uppercase text-[11px] text-[#C6A36A]">
                Etapa {currentStep} de {TOTAL_CONFIG_STEPS}
              </span>
              <span className="text-[11px] text-white/40">
                {Math.round(progressPercent)}% concluído
              </span>
            </div>

            {/* Linha da barra de progresso */}
            <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#C6A36A] to-[#E3C896] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progressPercent, 10)}%` }}
              />
            </div>
          </div>
        )}

        {/* Conteúdo da Etapa */}
        <div className="flex-1">{children}</div>

        {/* Rodapé de Navegação */}
        {!hideFooterActions && (
          <div className="mt-8 pt-6 border-t border-white/[0.08] flex items-center justify-between gap-3">
            {onBack && currentStep > 0 ? (
              <button
                type="button"
                onClick={onBack}
                disabled={isSaving}
                className="h-12 px-5 rounded-xl text-sm font-medium text-white/70
                           bg-white/[0.04] hover:bg-white/[0.08] hover:text-white
                           border border-white/10 hover:border-white/20
                           transition-all duration-150
                           flex items-center gap-2
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A36A]/60
                           disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar</span>
              </button>
            ) : (
              <div />
            )}

            {onNext && (
              <button
                type="button"
                onClick={onNext}
                disabled={isSaving || isNextDisabled}
                aria-busy={isSaving}
                className="h-12 px-6 rounded-xl text-sm font-medium text-[#1A1A1A]
                           bg-[#EDE8E1] hover:bg-[#F5F2EC] active:bg-[#E2DDD5]
                           active:scale-[0.99]
                           shadow-[0_4px_20px_rgba(237,232,225,0.14)]
                           transition-all duration-150
                           flex items-center justify-center gap-2
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A36A]/60
                           disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ml-auto"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#1A1A1A]" />
                ) : (
                  <>
                    <span>{nextButtonLabel}</span>
                    <ArrowRight className="h-4 w-4 text-[#736B5E]" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
