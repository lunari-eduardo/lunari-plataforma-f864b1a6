import React from 'react';
import { ArrowRight, Clock, Sparkle } from 'lucide-react';
import { LunariSymbolGold } from './LunariSymbolGold';
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
    <div className="space-y-6 sm:space-y-7 text-center animate-in fade-in zoom-in-[0.98] duration-300 py-2 sm:py-4">
      {/* 1. Logotipo do Lunari em Dourado */}
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="relative group">
          <div className="absolute -inset-4 bg-[#C6A36A]/15 blur-xl rounded-full opacity-60 pointer-events-none" />
          <LunariSymbolGold size={76} className="relative z-10 drop-shadow-[0_10px_25px_rgba(198,163,106,0.3)] transition-transform duration-300 hover:scale-105" />
        </div>

        {/* Estrela de 4 pontas / Sparkle */}
        <div className="flex items-center justify-center text-[#C6A36A]/80">
          <Sparkle className="w-3.5 h-3.5 fill-[#C6A36A]/80 text-[#C6A36A]" />
        </div>
      </div>

      {/* 2. Título "Vamos preparar seu Lunari" */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl md:text-[32px] font-light text-white tracking-tight leading-tight">
          Vamos preparar <span className="font-normal text-[#C6A36A] drop-shadow-[0_2px_10px_rgba(198,163,106,0.25)]">seu Lunari</span>
        </h1>
        {/* Linha de brilho sutil dourado */}
        <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#C6A36A]/50 to-transparent mx-auto" />
      </div>

      {/* 3. Textos Explicativos */}
      <div className="space-y-2 max-w-lg mx-auto">
        <p className="text-white/70 text-xs sm:text-sm md:text-[14.5px] leading-relaxed font-light">
          Em poucos passos, vamos configurar as informações básicas do seu negócio, seus tipos de fotografia, documentos e algumas preferências.
        </p>
        <p className="text-[#C6A36A] text-xs sm:text-sm font-normal tracking-wide pt-1">
          Você poderá alterar tudo depois.
        </p>
      </div>

      {/* Card de Retomada se o usuário parou no meio */}
      {isResuming && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-[#C6A36A]/30 text-left flex items-center justify-between gap-3 max-w-md mx-auto">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-medium text-[#C6A36A] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Continue de onde parou
            </p>
            <p className="text-xs text-white/80 font-light truncate">
              Você parou em <strong className="font-semibold text-white">{stoppedAtName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#C6A36A] text-[#121212] hover:bg-[#D4B37D] transition-colors cursor-pointer shrink-0"
          >
            Continuar
          </button>
        </div>
      )}

      {/* 4. Indicador "1 de 6" */}
      <div className="flex items-center justify-center gap-4 py-2">
        <div className="w-16 sm:w-24 h-[1.5px] bg-[#C6A36A]/90 rounded-full" />
        <span className="text-xs font-light text-white/60 tracking-widest uppercase">
          1 de 6
        </span>
        <div className="w-16 sm:w-24 h-[1.5px] bg-white/10 rounded-full" />
      </div>

      {/* 5. Ações (Botão Dourado Metálico + Configurar depois) */}
      <div className="space-y-4 pt-1 max-w-md mx-auto">
        <button
          type="button"
          onClick={isResuming ? onResume : onStart}
          className="w-full h-12 sm:h-13 rounded-2xl text-sm sm:text-base font-semibold text-[#221606]
                     bg-gradient-to-r from-[#B99256] via-[#E2BE80] to-[#B68E51]
                     hover:brightness-110 active:scale-[0.99]
                     shadow-[0_8px_30px_rgba(198,163,106,0.3)]
                     border border-[#E2BE80]/40
                     transition-all duration-200
                     flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{isResuming ? 'Continuar configuração' : 'Começar configuração'}</span>
        </button>

        {/* Configurar depois com seta */}
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center justify-center gap-1.5 text-xs text-[#C6A36A]/75 hover:text-[#E2BE80] transition-colors py-1.5 px-3 cursor-pointer group font-light"
        >
          <span>Configurar depois</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#C6A36A]/75 group-hover:text-[#E2BE80] group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>
    </div>
  );
}
