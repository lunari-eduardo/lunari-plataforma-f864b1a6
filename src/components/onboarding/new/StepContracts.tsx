import React from 'react';
import { FileSignature, Check, Sparkles, FileText, Info } from 'lucide-react';
import { CONTRATO_SEED_TEMPLATES } from '@/utils/contratoSeedTemplates';
import { cn } from '@/lib/utils';

interface StepContractsProps {
  wantsContracts: boolean | null;
  selectedSlugs: string[];
  onChange: (wantsContracts: boolean, selectedSlugs: string[]) => void;
}

export function StepContracts({
  wantsContracts,
  selectedSlugs,
  onChange,
}: StepContractsProps) {
  const handleDecision = (wants: boolean) => {
    if (wants) {
      // Se não havia nenhum selecionado, seleciona todos por padrão para conveniência
      const initial = selectedSlugs.length > 0 ? selectedSlugs : CONTRATO_SEED_TEMPLATES.map((s) => s.slug);
      onChange(true, initial);
    } else {
      onChange(false, []);
    }
  };

  const toggleSlug = (slug: string) => {
    const next = selectedSlugs.includes(slug)
      ? selectedSlugs.filter((s) => s !== slug)
      : [...selectedSlugs, slug];
    onChange(true, next);
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-normal text-white tracking-tight">
          Você utiliza contratos?
        </h2>
        <p className="text-sm text-white/60 font-light leading-relaxed">
          O Lunari permite criar e enviar contratos para seus clientes. Você pode começar usando modelos prontos e editá-los depois.
        </p>
      </div>

      {/* 2 Opções Principais: Sim ou Não */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={() => handleDecision(true)}
          className={cn(
            'p-4 rounded-2xl border text-left transition-all duration-150 relative cursor-pointer flex items-center gap-3',
            wantsContracts === true
              ? 'bg-white/[0.08] border-[#C6A36A] text-white shadow-[0_4px_20px_rgba(198,163,106,0.15)]'
              : 'bg-white/[0.02] border-white/[0.08] text-white/70 hover:bg-white/[0.05] hover:text-white'
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-[#C6A36A]/15 border border-[#C6A36A]/30 flex items-center justify-center shrink-0">
            <FileSignature className="w-5 h-5 text-[#C6A36A]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">Sim, quero usar contratos</p>
            <p className="text-xs text-white/50 font-light">Começar com modelos prontos</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleDecision(false)}
          className={cn(
            'p-4 rounded-2xl border text-left transition-all duration-150 relative cursor-pointer flex items-center gap-3',
            wantsContracts === false
              ? 'bg-white/[0.08] border-white/40 text-white'
              : 'bg-white/[0.02] border-white/[0.08] text-white/50 hover:bg-white/[0.05] hover:text-white/80'
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-white/40" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/80">Não por enquanto</p>
            <p className="text-xs text-white/40 font-light">Posso configurar depois</p>
          </div>
        </button>
      </div>

      {/* Se escolheu Sim: Seleção dos Modelos */}
      {wantsContracts === true && (
        <div className="space-y-4 pt-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wide">
              Escolha os modelos que deseja começar usando:
            </h3>
            <span className="text-[11px] text-[#C6A36A] font-medium">
              {selectedSlugs.length} selecionado{selectedSlugs.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2.5">
            {CONTRATO_SEED_TEMPLATES.map((seed) => {
              const isSelected = selectedSlugs.includes(seed.slug);
              return (
                <button
                  key={seed.slug}
                  type="button"
                  onClick={() => toggleSlug(seed.slug)}
                  className={cn(
                    'w-full p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer flex items-start justify-between gap-3',
                    isSelected
                      ? 'bg-white/[0.06] border-[#C6A36A]/60 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04] hover:text-white/90'
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-xl shrink-0 mt-0.5">{seed.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {seed.nome.replace('Contrato — ', '')}
                      </p>
                      <p className="text-xs text-white/50 font-light mt-0.5 line-clamp-2">
                        {seed.descricao}
                      </p>
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

          {/* Dica Informativa */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2.5 text-xs text-white/50 font-light">
            <Info className="w-4 h-4 text-[#C6A36A] shrink-0" />
            <span>
              Você poderá editar, duplicar ou criar novos modelos de contratos no Lunari quando quiser.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
