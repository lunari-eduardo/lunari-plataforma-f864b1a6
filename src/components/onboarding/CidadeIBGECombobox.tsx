import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Check, ChevronDown, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import debounce from 'lodash.debounce';

export interface CidadeIBGE {
  id: number;
  nome: string;
  uf: string;
}

interface CidadeIBGEComboboxProps {
  value: CidadeIBGE | null;
  onChange: (value: CidadeIBGE | null) => void;
  error?: string;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 1) return <>{text}</>;
  const nText = normalize(text);
  const nQuery = normalize(query);
  const idx = nText.indexOf(nQuery);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#C97A4A]/30 text-white rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function CidadeIBGECombobox({ value, onChange, error }: CidadeIBGEComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cities, setCities] = useState<CidadeIBGE[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const searchCities = useCallback(
    debounce(async (term: string) => {
      if (term.length < 2) {
        setCities([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const { data, error: err } = await supabase
          .from('municipios_ibge')
          .select('id, nome, uf')
          .ilike('nome', `%${term}%`)
          .order('nome')
          .limit(30);
        if (err) throw err;
        setCities(data || []);
      } catch (err) {
        console.error('Erro ao buscar cidades:', err);
        setCities([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [],
  );

  useEffect(() => () => searchCities.cancel(), [searchCities]);

  useEffect(() => {
    if (isOpen) searchCities(searchTerm);
  }, [searchTerm, isOpen, searchCities]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [cities]);

  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const dropdown = document.getElementById('cidade-dropdown-portal');
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (city: CidadeIBGE) => {
    onChange(city);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, cities.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = cities[highlightedIndex];
      if (item) handleSelect(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
      inputRef.current?.blur();
    }
  };

  const displayValue = value ? `${value.nome} – ${value.uf}` : '';

  const dropdownContent = isOpen
    ? createPortal(
        <div
          id="cidade-dropdown-portal"
          role="listbox"
          className="fixed z-[9999] bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          <div
            ref={listRef}
            className="overflow-y-auto max-h-[320px] py-1 onboarding-scrollbar"
          >
            {isLoading ? (
              <div className="px-4 py-6 text-sm text-white/50 text-center flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Buscando cidades...
              </div>
            ) : searchTerm.length < 2 ? (
              <div className="px-4 py-6 text-sm text-white/40 text-center flex flex-col items-center gap-2">
                <Search className="w-5 h-5 text-white/30" />
                Digite pelo menos 2 letras para buscar
              </div>
            ) : cities.length === 0 ? (
              <div className="px-4 py-6 text-sm text-white/40 text-center">
                Nenhuma cidade encontrada
              </div>
            ) : (
              cities.map((city, idx) => {
                const isSelected = value?.id === city.id;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={city.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-index={idx}
                    onClick={() => handleSelect(city)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      'w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-2',
                      'transition-colors duration-100',
                      isHighlighted && !isSelected && 'bg-white/[0.06]',
                      isSelected
                        ? 'bg-[#C97A4A]/15 text-[#C97A4A] font-medium border-l-2 border-[#C97A4A]'
                        : 'text-white/90',
                    )}
                  >
                    <span className="truncate">
                      <HighlightedText text={city.nome} query={searchTerm} />
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-medium text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded">
                        {city.uf}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#C97A4A]" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {cities.length > 0 && !isLoading && (
            <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/40 text-center font-light">
              ↑↓ navegar · Enter selecionar · Esc fechar
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col items-center text-center space-y-2">
        <h2 className="text-xl md:text-2xl font-light text-white tracking-wide">Onde você mora?</h2>
        <p className="text-white/60 text-sm font-light">Selecione sua cidade</p>
      </div>

      <div className="space-y-2" ref={containerRef}>
        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40 pointer-events-none z-10" />
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchTerm : displayValue}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onClick={() => setIsOpen(true)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Digite o nome da cidade..."
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="cidade-dropdown-portal"
            autoComplete="off"
            className={cn(
              'w-full h-12 pl-11 pr-10 rounded-xl bg-white/[0.04] border border-white/10',
              'text-sm font-light text-white placeholder:text-white/40',
              'transition-colors duration-150',
              'focus:outline-none focus:border-[#C97A4A]/60 focus:bg-white/[0.06]',
              error && 'border-red-400/60',
            )}
          />
          {isLoading ? (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40 animate-spin" />
          ) : (
            <ChevronDown
              className={cn(
                'absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40 transition-transform duration-200 pointer-events-none',
                isOpen && 'rotate-180',
              )}
            />
          )}
        </div>

        {dropdownContent}

        {error && (
          <p role="alert" aria-live="polite" className="text-xs text-red-400 text-center font-light">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
