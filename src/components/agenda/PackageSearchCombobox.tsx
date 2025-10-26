
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Check, ChevronDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { configurationService } from '@/services/ConfigurationService';

// Função para normalizar texto (remover acentos e caracteres especiais)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .replace(/[^a-z0-9\s]/g, ''); // Remove caracteres especiais
};

interface Package {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface PackageSearchComboboxProps {
  value?: string;
  onSelect: (packageId: string, packageData?: any) => void;
  placeholder?: string;
  filtrarPorCategoria?: string;
}

import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';

export default function PackageSearchCombobox({
  value,
  onSelect,
  placeholder = "Buscar pacote...",
  filtrarPorCategoria
}: PackageSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const realtimeConfig = useRealtimeConfiguration();
  
  // Use real-time data from Supabase
  const pacotes = realtimeConfig.pacotes || [];
  const categorias = realtimeConfig.categorias || [];
  
  // Carregar configurações de categorias
  const configCategorias = categorias;
  
  // Convert packages to the local Package format with correct category conversion
  const availablePackages: Package[] = pacotes.map(pacote => {
    // Convert categoria_id to category name using configCategorias
    let categoria = 'Sem categoria';
    if (pacote.categoria_id) {
      const categoriaConfig = configCategorias.find((cat) => cat.id === pacote.categoria_id);
      categoria = categoriaConfig?.nome || pacote.categoria_id;
    }
    
    return {
      id: pacote.id,
      name: pacote.nome,
      price: pacote.valor_base,
      category: categoria
    };
  });
  
  const [filteredPackages, setFilteredPackages] = useState<Package[]>(availablePackages);
  const selectedPackage = availablePackages.find(pkg => pkg.id === value);

  useEffect(() => {
    let filtered = availablePackages;
    
    // Filtrar por categoria se especificada
    if (filtrarPorCategoria) {
      filtered = filtered.filter(pkg => pkg.category === filtrarPorCategoria);
    }
    
    // Filtrar por termo de busca
    if (searchTerm) {
      const normalizedSearch = normalizeText(searchTerm);
      filtered = filtered.filter(pkg => {
        const normalizedName = normalizeText(pkg.name);
        const normalizedCategory = normalizeText(pkg.category);
        return normalizedName.includes(normalizedSearch) ||
               normalizedCategory.includes(normalizedSearch);
      });
    }
    
    setFilteredPackages(filtered);
  }, [searchTerm, availablePackages.length, filtrarPorCategoria]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Agrupar pacotes por categoria
  const groupedPackages = filteredPackages.reduce((acc, pkg) => {
    if (!acc[pkg.category]) {
      acc[pkg.category] = [];
    }
    acc[pkg.category].push(pkg);
    return acc;
  }, {} as Record<string, Package[]>);

  const handleSelect = (packageId: string) => {
    const pacoteSelecionado = realtimeConfig.pacotes.find(p => p.id === packageId);
    onSelect(packageId, pacoteSelecionado);
    setIsOpen(false);
    setSearchTerm('');
    setIsEditing(false);
    inputRef.current?.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setIsEditing(true);
  };

  const handleClear = () => {
    onSelect('', null);
    setSearchTerm('');
    setIsEditing(false);
    setIsOpen(false);
  };

  const displayValue = (isEditing || !selectedPackage)
    ? searchTerm
    : `${selectedPackage.name} - R$ ${selectedPackage.price.toFixed(2)}`;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          id="package-search-input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="pr-16 text-xs"
          aria-label="Buscar pacote"
          autoComplete="off"
        />
        {selectedPackage && !isEditing && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-8 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 dropdown-solid border border-border rounded-md shadow-lg max-h-60 overflow-auto scrollbar-minimal">
          {Object.keys(groupedPackages).length > 0 ? (
            Object.entries(groupedPackages).map(([category, packages]) => (
              <div key={category}>
                <div className="px-3 py-1 dropdown-solid-header text-[11px] font-medium text-muted-foreground border-b border-border">
                  {category}
                </div>
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    onClick={() => handleSelect(pkg.id)}
                    className="px-3 py-2 dropdown-solid-item cursor-pointer text-xs border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center">
                      <Package className="h-3 w-3 mr-2 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-medium">{pkg.name}</span>
                          {value === pkg.id && (
                            <Check className="ml-2 h-3 w-3 text-green-600" />
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          R$ {pkg.price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Nenhum pacote encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
