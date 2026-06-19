import React, { useState, useRef, useEffect, useMemo, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const NICHOS = [
  'Newborn',
  'Gestantes',
  'Família e Infantil',
  'Eventos Sociais',
  'Pre-wedding',
  'Casamentos',
  'Boudoir',
  'Pets',
  'Produtos',
  'Moda',
  'Retrato Corporativo',
  'Branding Pessoal',
  'Eventos Corporativos e Palestras',
  'Publicidade',
  'Esportes',
] as const;

export type Nicho = typeof NICHOS[number];

interface NichoComboboxProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const normalizeText = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function NichoCombobox({ value, onChange, error }: NichoComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredNichos = useMemo(
    () => NICHOS.filter((n) => normalizeText(n).includes(normalizeText(searchTerm))),
    [searchTerm],
  );

  const updateDropdownPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      setHighlightedIndex(0);
      // focus search input after portal renders
      const t = setTimeout(() => searchInputRef.current?.focus(), 0);
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        clearTimeout(t);
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // auto-scroll highlighted into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const dropdown = document.getElementById('nicho-dropdown-portal');
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (nicho: string) => {
    onChange(nicho);
    setIsOpen(false);
    setSearchTerm('');
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filteredNichos.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredNichos[highlightedIndex];
      if (item) handleSelect(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
      triggerRef.current?.focus();
    }
  };

  const dropdownContent = isOpen
    ? createPortal(
        <div
          id="nicho-dropdown-portal"
          role="listbox"
          className="fixed z-[9999] bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          {/* Sticky search */}
          <div className="p-2 border-b border-white/10 bg-[#0f0f0f]/80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar nicho..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#C97A4A]/60"
              />
            </div>
          </div>

          {/* List */}
          <div
            ref={listRef}
            className="overflow-y-auto max-h-[280px] py-1 onboarding-scrollbar"
          >
            {filteredNichos.length === 0 ? (
              <div className="px-4 py-6 text-sm text-white/40 text-center">
                Nenhum nicho encontrado
              </div>
            ) : (
              filteredNichos.map((nicho, idx) => {
                const isSelected = value === nicho;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={nicho}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-index={idx}
                    onClick={() => handleSelect(nicho)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      'w-full px-4 py-2.5 text-left text-sm flex items-center justify-between',
                      'transition-colors duration-100',
                      isHighlighted && !isSelected && 'bg-white/[0.06]',
                      isSelected
                        ? 'bg-[#C97A4A]/15 text-[#C97A4A] font-medium border-l-2 border-[#C97A4A]'
                        : 'text-white/90',
                    )}
                  >
                    <span>{nicho}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#C97A4A]" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/40 text-center font-light">
            ↑↓ navegar · Enter selecionar · Esc fechar
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col items-center text-center space-y-2">
        <h2 className="text-xl md:text-2xl font-light text-white tracking-wide">
          Qual é o seu nicho principal?
        </h2>
        <p className="text-white/60 text-sm font-light">
          Isso nos ajuda a personalizar sua experiência
        </p>
      </div>

      <div className="space-y-2" ref={containerRef}>
        <div className="relative">
          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40 pointer-events-none z-10" />
          <button
            ref={triggerRef}
            type="button"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="nicho-dropdown-portal"
            onClick={() => setIsOpen((v) => !v)}
            className={cn(
              'w-full h-12 pl-11 pr-10 rounded-xl bg-white/[0.04] border border-white/10',
              'text-left text-sm font-light text-white placeholder:text-white/40',
              'transition-colors duration-150',
              'hover:bg-white/[0.06]',
              'focus:outline-none focus:border-[#C97A4A]/60 focus:bg-white/[0.06]',
              error && 'border-red-400/60',
            )}
          >
            <span className={cn(!value && 'text-white/40')}>
              {value || 'Selecione seu nicho'}
            </span>
          </button>
          <ChevronDown
            className={cn(
              'absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40 transition-transform duration-200 pointer-events-none',
              isOpen && 'rotate-180',
            )}
          />
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
