import React, { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { User, MapPin, Instagram, Phone, Search, Loader2, Check, ChevronDown } from 'lucide-react';
import { BusinessData } from '@/services/OnboardingService';
import { CidadeIBGE } from '@/components/onboarding/CidadeIBGECombobox';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import debounce from 'lodash.debounce';

interface StepBusinessProps {
  data: BusinessData;
  onChange: (updates: Partial<BusinessData>) => void;
}

const formatWhatsApp = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const formatInstagram = (val: string) => {
  const clean = val.trim().replace(/\s/g, '');
  if (!clean) return '';
  if (clean.startsWith('@')) return clean;
  // Se começou a digitar texto direto sem @
  return `@${clean}`;
};

export function StepBusiness({ data, onChange }: StepBusinessProps) {
  const [citySearch, setCitySearch] = useState(data.cidade || '');
  const [citySuggestions, setCitySuggestions] = useState<CidadeIBGE[]>([]);
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const cityContainerRef = useRef<HTMLDivElement>(null);

  const searchCities = useCallback(
    debounce(async (term: string) => {
      if (term.length < 2) {
        setCitySuggestions([]);
        setIsSearchingCities(false);
        return;
      }
      setIsSearchingCities(true);
      try {
        const { data: results, error } = await supabase
          .from('municipios_ibge')
          .select('id, nome, uf')
          .ilike('nome', `%${term}%`)
          .order('nome')
          .limit(20);
        if (error) throw error;
        setCitySuggestions(results || []);
      } catch (err) {
        console.error('Erro ao buscar municípios:', err);
        setCitySuggestions([]);
      } finally {
        setIsSearchingCities(false);
      }
    }, 250),
    []
  );

  useEffect(() => () => searchCities.cancel(), [searchCities]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityContainerRef.current && !cityContainerRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCitySelect = (city: CidadeIBGE) => {
    const formatted = `${city.nome} - ${city.uf}`;
    setCitySearch(formatted);
    onChange({
      cidade: formatted,
      cidade_nome: city.nome,
      cidade_uf: city.uf,
      cidade_ibge_id: city.id,
    });
    setIsCityDropdownOpen(false);
  };

  const handleCityTextChange = (text: string) => {
    setCitySearch(text);
    onChange({
      cidade: text,
      cidade_nome: text,
    });
    setIsCityDropdownOpen(true);
    searchCities(text);
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-normal text-white tracking-tight">
          Sobre seu negócio
        </h2>
        <p className="text-sm text-white/60 font-light leading-relaxed">
          Essas informações serão usadas para identificar sua empresa no Lunari e em recursos que serão configurados depois.
        </p>
      </div>

      {/* Formulário com os 4 campos */}
      <div className="space-y-4 pt-2">
        {/* 1. Nome Profissional */}
        <div className="space-y-1.5">
          <label htmlFor="business-name" className="text-xs font-medium text-white/80">
            Nome profissional *
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              id="business-name"
              type="text"
              value={data.nome || ''}
              onChange={(e) => onChange({ nome: e.target.value })}
              placeholder="Ex.: Lise Fotografia"
              autoFocus
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-light text-white placeholder:text-white/30 focus:outline-none focus:border-[#C6A36A]/60 focus:bg-white/[0.06] transition-colors"
            />
          </div>
        </div>

        {/* 2. Cidade */}
        <div className="space-y-1.5 relative" ref={cityContainerRef}>
          <label htmlFor="business-city" className="text-xs font-medium text-white/80">
            Cidade *
          </label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none z-10" />
            <input
              id="business-city"
              ref={cityInputRef}
              type="text"
              value={citySearch}
              onChange={(e) => handleCityTextChange(e.target.value)}
              onFocus={() => {
                if (citySearch.length >= 2) {
                  setIsCityDropdownOpen(true);
                  searchCities(citySearch);
                }
              }}
              placeholder="Ex.: Porto Alegre"
              autoComplete="off"
              className="w-full h-12 pl-11 pr-10 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-light text-white placeholder:text-white/30 focus:outline-none focus:border-[#C6A36A]/60 focus:bg-white/[0.06] transition-colors"
            />
            {isSearchingCities && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin" />
            )}
          </div>

          {/* Sugestões de Cidade */}
          {isCityDropdownOpen && citySuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto onboarding-scrollbar">
              {citySuggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCitySelect(c)}
                  className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-white/90 hover:bg-white/[0.08] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>{c.nome}</span>
                  <span className="text-[10px] font-medium text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded">
                    {c.uf}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Instagram */}
        <div className="space-y-1.5">
          <label htmlFor="business-instagram" className="text-xs font-medium text-white/80">
            Instagram
          </label>
          <div className="relative">
            <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              id="business-instagram"
              type="text"
              value={data.instagram || ''}
              onChange={(e) => onChange({ instagram: formatInstagram(e.target.value) })}
              placeholder="Ex.: @lisefotografia"
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-light text-white placeholder:text-white/30 focus:outline-none focus:border-[#C6A36A]/60 focus:bg-white/[0.06] transition-colors"
            />
          </div>
        </div>

        {/* 4. WhatsApp */}
        <div className="space-y-1.5">
          <label htmlFor="business-whatsapp" className="text-xs font-medium text-white/80">
            WhatsApp
          </label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              id="business-whatsapp"
              type="tel"
              value={data.whatsapp || ''}
              onChange={(e) => onChange({ whatsapp: formatWhatsApp(e.target.value) })}
              placeholder="Ex.: (51) 99999-9999"
              maxLength={15}
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-light text-white placeholder:text-white/30 focus:outline-none focus:border-[#C6A36A]/60 focus:bg-white/[0.06] transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
