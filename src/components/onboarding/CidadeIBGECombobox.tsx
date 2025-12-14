import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Check, ChevronDown, Loader2 } from 'lucide-react';
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

export function CidadeIBGECombobox({ value, onChange, error }: CidadeIBGEComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cities, setCities] = useState<CidadeIBGE[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleSelect = (city: CidadeIBGE) => {
    onChange(city);
    setIsOpen(false);
    setSearchTerm('');
  };

  const displayValue = value ? `${value.nome} – ${value.uf}` : '';

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
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 transition-transform",
                isOpen && "rotate-180"
              )} 
            />
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full max-w-md left-1/2 -translate-x-1/2 mt-2 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Buscando...
              </div>
            ) : searchTerm.length < 2 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                Digite pelo menos 2 caracteres
              </div>
            ) : cities.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                Nenhuma cidade encontrada
              </div>
            ) : (
              cities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleSelect(city)}
                  className={cn(
                    "w-full px-4 py-3 text-left text-sm hover:bg-accent flex items-center justify-between",
                    value?.id === city.id && "bg-accent"
                  )}
                >
                  <span>{city.nome} – {city.uf}</span>
                  {value?.id === city.id && <Check className="w-4 h-4 text-primary" />}
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
