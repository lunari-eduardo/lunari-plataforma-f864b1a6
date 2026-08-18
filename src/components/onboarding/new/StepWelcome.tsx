import React from 'react';
import { Sparkles, ArrowRight, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { TOTAL_CONFIG_STEPS } from '@/hooks/useOnboarding';

interface StepWelcomeProps {
  lastSavedStep: number | null;
  onStart: () => void;
  onResume: () => void;
  onSkip: () => void;
}

const STEP_NAMES: Record<number, string> = {
  1: 'Seu negócio',
  2: 'O que você fotografa',
  3: 'Contratos',
  4: 'Formulários',
  5: 'Sua marca',
  6: 'Fotos extras',
};

export function StepWelcome({ lastSavedStep, onStart, onResume, onSkip }: StepWelcomeProps) {
  const isResuming = lastSavedStep && lastSavedStep > 0 && lastSavedStep <= TOTAL_CONFIG_STEPS;
  const stoppedAtName = isResuming ? STEP_NAMES[lastSavedStep] || 'Configuração' : null;

  return (
    <div className="space-y-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Ícone de Destaque */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-2xl bg-[#C6A36A]/10 border border-[#C6A36A]/20 flex items-center justify-center shadow-[0_0_30px_rgba(198,163,106,0.15)]">
          <Sparkles className="w-8 h-8 text-[#C6A36A]" />
        </div>
      </div>

      {/* Título e Texto */}
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/[0.05] border border-white/10 text-[#C6A36A]">
          <ShieldCheck className="w-3.5 h-3.5" />
          Configuração Inicial
        </span>
        <h1 className="text-2xl sm:text-3xl font-normal text-white tracking-tight">
          Vamos preparar seu Lunari
        </h1>
        <p className="text-white/70 text-sm sm:text-base max-w-md mx-auto leading-relaxed font-light">
          Em poucos passos, vamos configurar as informações básicas do seu negócio, seus tipos de fotografia, documentos e algumas preferências.
        </p>
        <p className="text-white/40 text-xs font-light">
          Você poderá alterar tudo depois sempre que precisar.
        </p>
      </div>

      {/* Card de Retomada se o usuário já tiver começado */}
      {isResuming && (
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-[#C6A36A]/30 text-left flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-[#C6A36A] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Continue de onde parou
            </p>
            <p className="text-sm text-white/90 font-light">
              Você parou em <strong className="font-semibold text-white">{stoppedAtName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#C6A36A] text-[#121212] hover:bg-[#D4B37D] transition-colors cursor-pointer shrink-0"
          >
            Continuar
          </button>
        </div>
      )}

      {/* Lista de Recursos que serão preparados */}
      <div className="grid grid-cols-2 gap-2.5 text-left py-2">
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#C6A36A] shrink-0" />
          <span className="text-xs text-white/80 font-light">Perfil e Contato</span>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#C6A36A] shrink-0" />
          <span className="text-xs text-white/80 font-light">Categorias de Ensaios</span>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#C6A36A] shrink-0" />
          <span className="text-xs text-white/80 font-light">Contratos Prontos</span>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#C6A36A] shrink-0" />
          <span className="text-xs text-white/80 font-light">Formulários e Briefings</span>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="space-y-3 pt-2">
        <button
          type="button"
          onClick={isResuming ? onResume : onStart}
          className="w-full h-13 rounded-xl text-base font-medium text-[#1A1A1A]
                     bg-[#EDE8E1] hover:bg-[#F5F2EC] active:bg-[#E2DDD5]
                     active:scale-[0.99]
                     shadow-[0_4px_25px_rgba(237,232,225,0.18)]
                     transition-all duration-150
                     flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{isResuming ? 'Continuar configuração' : 'Começar configuração'}</span>
          <ArrowRight className="h-4 w-4 text-[#736B5E]" />
        </button>

        {/* Ação secundária sutil "Configurar depois" */}
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-normal text-white/40 hover:text-white/70 transition-colors py-2 px-4 cursor-pointer"
        >
          Configurar depois
        </button>
      </div>
    </div>
  );
}
