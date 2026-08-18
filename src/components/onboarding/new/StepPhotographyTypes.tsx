import React, { useState } from 'react';
import { PhotographyTypesData } from '@/services/OnboardingService';
import { Check, Sparkles, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepPhotographyTypesProps {
  data: PhotographyTypesData;
  onChange: (updates: Partial<PhotographyTypesData>) => void;
}

interface CategoryOption {
  id: string;
  name: string;
  emoji: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: 'gestante', name: 'Gestante', emoji: '🤰' },
  { id: 'newborn', name: 'Newborn', emoji: '👶' },
  { id: 'infantil', name: 'Infantil', emoji: '🧸' },
  { id: 'familia', name: 'Família', emoji: '👨‍👩‍👧' },
  { id: 'casamento', name: 'Casamento', emoji: '💍' },
  { id: 'eventos', name: 'Eventos', emoji: '🎉' },
  { id: 'corporativo', name: 'Corporativo', emoji: '💼' },
  { id: 'ensaio', name: 'Ensaio', emoji: '📸' },
  { id: 'smash', name: 'Smash the Cake', emoji: '🎂' },
  { id: 'produto', name: 'Produto', emoji: '📦' },
];

export function StepPhotographyTypes({ data, onChange }: StepPhotographyTypesProps) {
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const selectedCategories = data.categories || [];
  const mainNiche = data.mainNiche || null;

  const toggleCategory = (catName: string) => {
    let next: string[];
    if (selectedCategories.includes(catName)) {
      next = selectedCategories.filter((c) => c !== catName);
      // Se desmarcou o que era nicho principal, remove também o nicho principal
      if (mainNiche === catName) {
        onChange({ mainNiche: null, categories: next });
        return;
      }
    } else {
      next = [...selectedCategories, catName];
    }
    onChange({ categories: next });
  };

  const handleMainNicheSelect = (nicheName: string | null) => {
    if (!nicheName || nicheName === 'none') {
      onChange({ mainNiche: null });
      return;
    }

    // Se escolheu um nicho principal, garante que ele também esteja no array de categorias
    const nextCategories = selectedCategories.includes(nicheName)
      ? selectedCategories
      : [...selectedCategories, nicheName];

    onChange({
      mainNiche: nicheName,
      categories: nextCategories,
    });
  };

  const handleAddCustomCategory = () => {
    const trimmed = customCategoryInput.trim();
    if (trimmed && !selectedCategories.includes(trimmed)) {
      onChange({
        categories: [...selectedCategories, trimmed],
      });
      setCustomCategoryInput('');
      setIsAddingCustom(false);
    }
  };

  return (
    <div className="space-y-7 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-normal text-white tracking-tight">
          O que você fotografa?
        </h2>
        <p className="text-sm text-white/60 font-light leading-relaxed">
          Escolha os tipos de fotografia que fazem parte do seu trabalho. Eles serão cadastrados automaticamente como categorias no Lunari.
        </p>
      </div>

      {/* 2.1 Nicho Principal (Opcional) */}
      <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C6A36A]" />
            Qual é o seu principal nicho? <span className="text-white/40 font-normal">(Opcional)</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleMainNicheSelect(null)}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer border',
              !mainNiche
                ? 'bg-[#C6A36A]/15 border-[#C6A36A] text-[#EDE8E1] font-medium shadow-[0_0_15px_rgba(198,163,106,0.2)]'
                : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]'
            )}
          >
            Ainda não quero definir
          </button>

          {CATEGORY_OPTIONS.slice(0, 6).map((opt) => {
            const isSelected = mainNiche === opt.name;
            return (
              <button
                key={`main-${opt.id}`}
                type="button"
                onClick={() => handleMainNicheSelect(opt.name)}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer border flex items-center gap-1.5',
                  isSelected
                    ? 'bg-[#C6A36A] border-[#C6A36A] text-[#121212] font-semibold shadow-[0_0_15px_rgba(198,163,106,0.3)]'
                    : 'bg-white/[0.03] border-white/10 text-white/80 hover:text-white hover:bg-white/[0.06]'
                )}
              >
                <span>{opt.emoji}</span>
                <span>{opt.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2.2 Categorias de Fotografia */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-white/90">
          Selecione também outros tipos de fotografia que você oferece
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {CATEGORY_OPTIONS.map((cat) => {
            const isSelected = selectedCategories.includes(cat.name);
            const isMain = mainNiche === cat.name;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.name)}
                className={cn(
                  'p-3.5 rounded-2xl border text-left transition-all duration-150 relative cursor-pointer group flex items-center justify-between gap-2',
                  isSelected
                    ? 'bg-white/[0.08] border-[#C6A36A]/70 text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
                    : 'bg-white/[0.02] border-white/[0.08] text-white/70 hover:bg-white/[0.05] hover:text-white hover:border-white/20'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0 group-hover:scale-110 transition-transform">
                    {cat.emoji}
                  </span>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-medium block truncate">
                      {cat.name}
                    </span>
                    {isMain && (
                      <span className="text-[9px] text-[#C6A36A] font-medium block">
                        Principal
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors border',
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

          {/* Categorias personalizadas adicionadas */}
          {selectedCategories
            .filter((c) => !CATEGORY_OPTIONS.some((opt) => opt.name === c))
            .map((customName) => (
              <button
                key={customName}
                type="button"
                onClick={() => toggleCategory(customName)}
                className="p-3.5 rounded-2xl border bg-white/[0.08] border-[#C6A36A]/70 text-white flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">✨</span>
                  <span className="text-xs sm:text-sm font-medium truncate">{customName}</span>
                </div>
                <div className="w-5 h-5 rounded-full bg-[#C6A36A] flex items-center justify-center shrink-0 text-[#121212]">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              </button>
            ))}
        </div>

        {/* Adicionar Outra Categoria */}
        <div className="pt-2">
          {isAddingCustom ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={customCategoryInput}
                onChange={(e) => setCustomCategoryInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCategory()}
                placeholder="Ex.: Formatura / Pets"
                autoFocus
                className="flex-1 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/15 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#C6A36A]/60"
              />
              <button
                type="button"
                onClick={handleAddCustomCategory}
                className="px-4 h-10 rounded-xl text-xs font-semibold bg-[#C6A36A] text-[#121212] hover:bg-[#D4B37D] transition-colors cursor-pointer"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => setIsAddingCustom(false)}
                className="px-3 h-10 rounded-xl text-xs text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingCustom(true)}
              className="inline-flex items-center gap-1.5 text-xs text-[#C6A36A] hover:text-[#D4B37D] transition-colors font-medium py-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar outro tipo de ensaio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
