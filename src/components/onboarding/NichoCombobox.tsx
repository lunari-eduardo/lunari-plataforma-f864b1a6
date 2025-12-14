import React, { useState, useRef, useEffect } from 'react';
import { Briefcase, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const NICHOS = [
  'Gestante',
  'Newborn',
  'Materno-infantil',
  'Marca Pessoal',
  'Eventos',
  'Moda',
  'Editorial',
  'Publicitária',
  'Outros'
] as const;

export type Nicho = typeof NICHOS[number];

interface NichoComboboxProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function NichoCombobox({ value, onChange, error }: NichoComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalizar texto para busca (remove acentos)
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Filtrar nichos
  const filteredNichos = NICHOS.filter(nicho =>
    normalizeText(nicho).includes(normalizeText(searchTerm))
  );

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-light text-white">
            Qual é o seu nicho principal?
          </h2>
          <p className="text-white/80 text-sm font-light">
            Isso nos ajuda a personalizar sua experiência
          </p>
        </div>
      </div>

      <div className="space-y-2" ref={containerRef}>
        <div className="relative">
          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 z-10" />
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchTerm : value}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onClick={() => setIsOpen(true)}
            onFocus={() => setIsOpen(true)}
            placeholder="Selecione seu nicho"
            className={cn(
              "w-full pl-12 pr-10 h-12 bg-white/10 border border-white/30 rounded-md",
              "text-center font-light text-white placeholder:text-white/50",
              "focus:outline-none focus:ring-2 focus:ring-[#CD7F5E] focus:border-transparent",
              error && "border-red-400"
            )}
          />
          <ChevronDown 
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 transition-transform",
              isOpen && "rotate-180"
            )} 
          />
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full max-w-md left-1/2 -translate-x-1/2 mt-2 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filteredNichos.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                Nenhum nicho encontrado
              </div>
            ) : (
              filteredNichos.map((nicho) => (
                <button
                  key={nicho}
                  type="button"
                  onClick={() => handleSelect(nicho)}
                  className={cn(
                    "w-full px-4 py-3 text-left text-sm hover:bg-accent flex items-center justify-between",
                    value === nicho && "bg-accent"
                  )}
                >
                  <span>{nicho}</span>
                  {value === nicho && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 text-center font-light">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
