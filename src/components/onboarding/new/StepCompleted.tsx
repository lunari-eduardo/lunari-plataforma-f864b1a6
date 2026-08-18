import React from 'react';
import { OnboardingFormData } from '@/hooks/useOnboarding';
import { LunariSymbolGold } from './LunariSymbolGold';
import {
  Check,
  ArrowRight,
  Sparkle,
  Building2,
  Shapes,
  FileSignature,
  ClipboardList,
  Palette,
  DollarSign,
} from 'lucide-react';

interface StepCompletedProps {
  formData: OnboardingFormData;
  onFinish: () => void;
  isSaving: boolean;
}

export function StepCompleted({ formData, onFinish, isSaving }: StepCompletedProps) {
  const hasContracts =
    formData.contracts.wantsContracts === true && formData.contracts.selectedSlugs.length > 0;
  const hasForms =
    formData.forms.wantsForms === true && formData.forms.selectedSlugs.length > 0;
  const hasBrand = !!(formData.brand.logoUrl || formData.brand.brandName || formData.brand.brandColor);

  const pricingLabel =
    formData.pricing.model === 'categoria'
      ? 'Tabela por categoria'
      : formData.pricing.model === 'global'
      ? 'Tabela progressiva'
      : 'Preço fixo por pacote';

  const summaryItems = [
    {
      label: 'Seu negócio',
      detail: formData.business.nome || 'Informações salvas',
      status: true,
      icon: Building2,
    },
    {
      label: 'Categorias',
      detail: `${formData.photographyTypes.categories.length} tipos cadastrados`,
      status: formData.photographyTypes.categories.length > 0,
      icon: Shapes,
    },
    {
      label: 'Contratos',
      detail: hasContracts
        ? `${formData.contracts.selectedSlugs.length} modelos prontos`
        : 'Não configurado',
      status: hasContracts,
      icon: FileSignature,
    },
    {
      label: 'Formulários',
      detail: hasForms
        ? `${formData.forms.selectedSlugs.length} modelos prontos`
        : 'Não configurado',
      status: hasForms,
      icon: ClipboardList,
    },
    {
      label: 'Identidade visual',
      detail: hasBrand ? 'Logomarca e cores salvas' : 'Não configurado',
      status: hasBrand,
      icon: Palette,
    },
    {
      label: 'Fotos extras',
      detail: pricingLabel,
      status: true,
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-7 text-center animate-in fade-in zoom-in-[0.98] duration-300 py-2 sm:py-4">
      {/* 1. Logotipo do Lunari em Dourado */}
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="relative group">
          <div className="absolute -inset-4 bg-[#C6A36A]/15 blur-xl rounded-full opacity-60 pointer-events-none" />
          <LunariSymbolGold
            size={76}
            className="relative z-10 drop-shadow-[0_10px_25px_rgba(198,163,106,0.3)] transition-transform duration-300 hover:scale-105"
          />
        </div>

        {/* Estrela de 4 pontas / Sparkle */}
        <div className="flex items-center justify-center text-[#C6A36A]/80">
          <Sparkle className="w-3.5 h-3.5 fill-[#C6A36A]/80 text-[#C6A36A]" />
        </div>
      </div>

      {/* 2. Título e Mensagem */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight leading-tight">
          Seu Lunari <span className="font-normal text-[#C6A36A] drop-shadow-[0_2px_10px_rgba(198,163,106,0.25)]">está pronto</span>
        </h1>
        <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#C6A36A]/50 to-transparent mx-auto" />
        <p className="text-xs sm:text-sm text-white/70 font-light max-w-md mx-auto pt-1">
          Configuramos as informações principais para você começar.
        </p>
      </div>

      {/* 3. Resumo Limpo e Minimalista */}
      <div className="space-y-2 text-left pt-1 max-w-lg mx-auto">
        {summaryItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-white/60" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-white/90">{item.label}</p>
                  <p className="text-[11px] text-white/40 font-light truncate">{item.detail}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.status ? (
                  <span className="inline-flex items-center gap-1 text-xs text-[#C6A36A] font-medium">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    configurado
                  </span>
                ) : (
                  <span className="text-xs text-white/30 font-light">não configurado</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Mensagem Final de Conforto (sem citar páginas específicas) */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-1 max-w-lg mx-auto">
        <p className="text-xs text-white/80 font-normal">
          Você não precisa configurar tudo agora.
        </p>
        <p className="text-xs text-white/40 font-light">
          O restante pode ser ajustado no Lunari quando você precisar.
        </p>
      </div>

      {/* 5. Botão de Entrada em Dourado Metálico */}
      <div className="pt-2 max-w-md mx-auto">
        <button
          type="button"
          onClick={onFinish}
          disabled={isSaving}
          className="w-full h-12 sm:h-13 rounded-2xl text-sm sm:text-base font-semibold text-[#221606]
                     bg-gradient-to-r from-[#B99256] via-[#E2BE80] to-[#B68E51]
                     hover:brightness-110 active:scale-[0.99]
                     shadow-[0_8px_30px_rgba(198,163,106,0.3)]
                     border border-[#E2BE80]/40
                     transition-all duration-200
                     flex items-center justify-center gap-2 cursor-pointer
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Entrar no Lunari</span>
          <ArrowRight className="h-4 w-4 text-[#221606]" />
        </button>
      </div>
    </div>
  );
}
