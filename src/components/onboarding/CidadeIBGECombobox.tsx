import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Check, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export function CidadeIBGECombobox({ value, onChange, error }: CidadeIBGEComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cities, setCities] = useState<CidadeIBGE[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Buscar cidades no banco
  const searchCities = useCallback(
    debounce(async (term: string) => {
      if (term.length < 2) {
        setCities([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error: err } = await supabase
          .from('municipios_ibge')
          .select('id, nome, uf')
          .ilike('nome', `%${term}%`)
          .order('nome')
          .limit(20);

        if (err) throw err;
        setCities(data || []);
      } catch (err) {
        console.error('Erro ao buscar cidades:', err);
        setCities([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      searchCities.cancel();
    };
  }, [searchCities]);

  // Atualizar busca quando termo muda
  useEffect(() => {
    if (isOpen) {
      searchCities(searchTerm);
    }
  }, [searchTerm, isOpen, searchCities]);

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
        const dropdown = document.getElementById('cidade-dropdown-portal');
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

  const handleSelect = (city: CidadeIBGE) => {
    onChange(city);
    setIsOpen(false);
    setSearchTerm('');
  };

  const displayValue = value ? `${value.nome} – ${value.uf}` : '';

  // Dropdown renderizado via Portal
  const dropdownContent = isOpen ? createPortal(
    <div 
      id="cidade-dropdown-portal"
      className="fixed z-[9999] bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl shadow-2xl overflow-hidden"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
    >
      <ScrollArea className="h-[320px]">
        <div className="py-1">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando...
            </div>
          ) : searchTerm.length < 2 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Digite pelo menos 2 caracteres
            </div>
          ) : cities.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Nenhuma cidade encontrada
            </div>
          ) : (
            cities.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => handleSelect(city)}
                className={cn(
                  "w-full px-4 py-3 text-left text-sm flex items-center justify-between",
                  "transition-all duration-150 ease-out",
                  "hover:bg-[#CD7F5E]/10",
                  value?.id === city.id 
                    ? "bg-[#CD7F5E]/15 text-[#CD7F5E] font-medium border-l-2 border-[#CD7F5E]" 
                    : "text-gray-700"
                )}
              >
                <span>{city.nome} – {city.uf}</span>
                {value?.id === city.id && <Check className="w-4 h-4 text-[#CD7F5E]" />}
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
            Onde você mora?
          </h2>
          <p className="text-white/80 text-sm font-light">
            Selecione sua cidade
          </p>
        </div>
      </div>

      <div className="space-y-2" ref={containerRef}>
        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 z-10" />
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
            placeholder="Digite o nome da cidade..."
            className={cn(
              "w-full pl-12 pr-10 h-12 bg-white/10 border border-white/30 rounded-md",
              "text-center font-light text-white placeholder:text-white/50",
              "focus:outline-none focus:ring-2 focus:ring-[#CD7F5E] focus:border-transparent",
              error && "border-red-400"
            )}
          />
          {isLoading ? (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 animate-spin" />
          ) : (
            <ChevronDown 
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 transition-transform duration-200",
                isOpen && "rotate-180"
              )} 
            />
          )}
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
