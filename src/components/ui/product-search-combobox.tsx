import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useDialogDropdownContext } from "@/components/ui/dialog";

// Função para normalizar texto (remover acentos e caracteres especiais)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .replace(/[^a-z0-9\s]/g, ''); // Remove caracteres especiais
};

interface Product {
  id: string;
  nome: string;
  custo?: number;
  valorVenda?: number;
  preco_venda?: number;
  valor?: number;
  categoria?: string;
}

interface ProductSearchComboboxProps {
  products: Product[];
  onSelect: (product: Product | null) => void;
  placeholder?: string;
  className?: string;
}

export function ProductSearchCombobox({
  products,
  onSelect,
  placeholder = "Selecionar produto...",
  className
}: ProductSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Integrar com DialogDropdownContext para evitar conflitos de z-index
  const dialogContext = useDialogDropdownContext();
  
  useEffect(() => {
    dialogContext?.setHasOpenDropdown(isOpen);
  }, [isOpen, dialogContext]);

  // Click-outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getProductValue = (product: Product): number => {
    return product.valorVenda || product.preco_venda || product.valor || 0;
  };

  // Filtrar produtos com base no termo de busca (normalizado)
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    
    const normalizedSearch = normalizeText(searchTerm);
    return products.filter(product => {
      const normalizedName = normalizeText(product.nome);
      const normalizedCategory = normalizeText(product.categoria || '');
      return normalizedName.includes(normalizedSearch) || 
             normalizedCategory.includes(normalizedSearch);
    });
  }, [products, searchTerm]);

  const handleSelect = (product: Product) => {
    onSelect(product);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="pr-8 text-xs h-7"
        />
        <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      </div>
      
      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => {
              const valorProduto = getProductValue(product);
              
              return (
                <div
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className="px-3 py-2 hover:bg-accent cursor-pointer text-xs"
                >
                  <div className="font-medium">{product.nome}</div>
                  <div className="text-2xs text-muted-foreground">
                    R$ {valorProduto.toFixed(2)}
                    {product.categoria && ` • ${product.categoria}`}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Nenhum produto encontrado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
