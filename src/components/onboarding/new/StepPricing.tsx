import React from 'react';
import { PricingModelChoice } from '@/services/OnboardingService';
import { DollarSign, TrendingDown, Layers, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepPricingProps {
  model: PricingModelChoice;
  onChange: (model: PricingModelChoice) => void;
}

interface PricingOptionDef {
  id: PricingModelChoice;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  explanationTitle: string;
  explanationText: string;
}

const PRICING_OPTIONS: PricingOptionDef[] = [
  {
    id: 'fixo',
    title: 'Preço fixo por pacote',
    subtitle: 'Cada pacote possui seu próprio valor por foto extra.',
    icon: DollarSign,
    explanationTitle: 'Você escolheu Preço fixo por pacote',
    explanationText:
      'Cada pacote cadastrado terá um valor unitário fixo por foto adicional comprada pelo cliente (por exemplo, R$ 25 por foto extra).',
  },
  {
    id: 'global',
    title: 'Tabela progressiva',
    subtitle: 'Quanto mais fotos o cliente compra, menor fica o valor por foto.',
    icon: TrendingDown,
    explanationTitle: 'Você escolheu Tabela progressiva',
    explanationText:
      'O Lunari aplicará descontos automáticos por volume para todos os ensaios (ex: 1 a 10 fotos = R$ 30 cada; 11 a 20 fotos = R$ 25 cada).',
  },
  {
    id: 'categoria',
    title: 'Tabela por categoria',
    subtitle: 'Cada tipo de ensaio possui sua própria tabela de preços.',
    icon: Layers,
    explanationTitle: 'Você escolheu Tabela por categoria',
    explanationText:
      'O Lunari permitirá definir regras de precificação exclusivas para cada categoria, como Gestante, Newborn ou Casamento.',
  },
];

export function StepPricing({ model, onChange }: StepPricingProps) {
  const currentOption = PRICING_OPTIONS.find((opt) => opt.id === model) || PRICING_OPTIONS[0];

  return (
    <div className="space-y-6 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header Didático */}
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-normal text-white tracking-tight">
          Como você vende fotos além do pacote?
        </h2>
        <p className="text-sm text-white/60 font-light leading-relaxed">
          Escolha como o Lunari deve calcular o valor das fotos extras quando um cliente quiser comprar imagens adicionais.
        </p>
      </div>

      {/* 3 Opções Claras */}
      <div className="space-y-3 pt-1">
        {PRICING_OPTIONS.map((opt) => {
          const isSelected = model === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                'w-full p-4 rounded-2xl border text-left transition-all duration-150 relative cursor-pointer flex items-start justify-between gap-3 group',
                isSelected
                  ? 'bg-white/[0.08] border-[#C6A36A] text-white shadow-[0_4px_20px_rgba(198,163,106,0.15)]'
                  : 'bg-white/[0.02] border-white/[0.08] text-white/70 hover:bg-white/[0.05] hover:text-white'
              )}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors',
                    isSelected
                      ? 'bg-[#C6A36A]/20 border-[#C6A36A]/40 text-[#C6A36A]'
                      : 'bg-white/[0.04] border-white/10 text-white/40 group-hover:text-white/70'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-white">{opt.title}</p>
                  <p className="text-xs text-white/50 font-light">{opt.subtitle}</p>
                </div>
              </div>

              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors border mt-1',
                  isSelected
                    ? 'bg-[#C6A36A] border-[#C6A36A] text-[#121212]'
                    : 'border-white/20 bg-white/[0.03]'
                )}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explicação Contextual Dinâmica */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-[#C6A36A]/20 space-y-2 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#C6A36A]">
          <Info className="w-4 h-4" />
          <span>{currentOption.explanationTitle}</span>
        </div>
        <p className="text-xs text-white/70 font-light leading-relaxed">
          {currentOption.explanationText}
        </p>
        <p className="text-[11px] text-white/40 font-light pt-1 border-t border-white/[0.06]">
          Você poderá alterar essa configuração posteriormente em:{' '}
          <strong className="text-white/80 font-medium">Configurações → Modelos de preço</strong>. Os valores e regras podem ser ajustados conforme cada categoria ou pacote.
        </p>
      </div>
    </div>
  );
}
