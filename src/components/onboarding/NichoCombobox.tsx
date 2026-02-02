import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  'Esportes'
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
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

  // Calcular posição do dropdown
  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  };

  // Atualizar posição quando abrir
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
    }
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Também verificar se o clique foi no dropdown do portal
        const dropdown = document.getElementById('nicho-dropdown-portal');
        if (dropdown && dropdown.contains(e.target as Node)) {
          return;
        }
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

  // Dropdown renderizado via Portal
  const dropdownContent = isOpen ? createPortal(
    <div 
      id="nicho-dropdown-portal"
      className="fixed z-[9999] bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl shadow-2xl overflow-hidden"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
    >
      <ScrollArea className="h-[320px]">
        <div className="py-1">
          {filteredNichos.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Nenhum nicho encontrado
            </div>
          ) : (
            filteredNichos.map((nicho) => (
              <button
                key={nicho}
                type="button"
                onClick={() => handleSelect(nicho)}
                className={cn(
                  "w-full px-4 py-3 text-left text-sm flex items-center justify-between",
                  "transition-all duration-150 ease-out",
                  "hover:bg-[#CD7F5E]/10",
                  value === nicho 
                    ? "bg-[#CD7F5E]/15 text-[#CD7F5E] font-medium border-l-2 border-[#CD7F5E]" 
                    : "text-gray-700"
                )}
              >
                <span>{nicho}</span>
                {value === nicho && <Check className="w-4 h-4 text-[#CD7F5E]" />}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>,
    document.body
  ) : null;

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
              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 transition-transform duration-200",
              isOpen && "rotate-180"
            )} 
          />
        </div>

        {/* Dropdown via Portal */}
        {dropdownContent}

        {error && (
          <p className="text-sm text-red-400 text-center font-light">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}