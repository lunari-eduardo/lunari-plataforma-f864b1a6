import React from 'react';
import { OnboardingFormData } from '@/hooks/useOnboarding';
import { Check, ArrowRight, Sparkles, Building2, Shapes, FileSignature, ClipboardList, Palette, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepCompletedProps {
  formData: OnboardingFormData;
  onFinish: () => void;
  isSaving: boolean;
}

export function StepCompleted({ formData, onFinish, isSaving }: StepCompletedProps) {
  const hasContracts = formData.contracts.wantsContracts === true && formData.contracts.selectedSlugs.length > 0;
  const hasForms = formData.forms.wantsForms === true && formData.forms.selectedSlugs.length > 0;
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
    <div className="space-y-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Ícone de Sucesso */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-2xl bg-[#C6A36A]/15 border border-[#C6A36A]/30 flex items-center justify-center shadow-[0_0_40px_rgba(198,163,106,0.25)]">
          <Sparkles className="w-8 h-8 text-[#C6A36A]" />
        </div>
      </div>

      {/* Título e Mensagem */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-normal text-white tracking-tight">
          Seu Lunari está pronto
        </h1>
        <p className="text-sm sm:text-base text-white/70 font-light max-w-md mx-auto">
          Configuramos as informações principais para você começar.
        </p>
      </div>

      {/* Resumo Limpo e Minimalista */}
      <div className="space-y-2 text-left pt-1">
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

      {/* Mensagem Final de Conforto */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-1">
        <p className="text-xs text-white/80 font-normal">
          Você não precisa configurar tudo agora.
        </p>
        <p className="text-xs text-white/40 font-light">
          O restante pode ser ajustado quando precisar em Configurações.
        </p>
      </div>

      {/* Botão de Entrada */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onFinish}
          disabled={isSaving}
          className="w-full h-13 rounded-xl text-base font-medium text-[#1A1A1A]
                     bg-[#EDE8E1] hover:bg-[#F5F2EC] active:bg-[#E2DDD5]
                     active:scale-[0.99]
                     shadow-[0_4px_25px_rgba(237,232,225,0.18)]
                     transition-all duration-150
                     flex items-center justify-center gap-2 cursor-pointer
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Entrar no Lunari</span>
          <ArrowRight className="h-4 w-4 text-[#736B5E]" />
        </button>
      </div>
    </div>
  );
}
