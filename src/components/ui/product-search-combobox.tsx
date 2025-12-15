import { useState, useMemo, useEffect, useRef } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Integrar com DialogDropdownContext para evitar conflitos de z-index
  const dialogContext = useDialogDropdownContext();
  
  useEffect(() => {
    dialogContext?.setHasOpenDropdown(open);
  }, [open, dialogContext]);

  // Foco confiável usando double requestAnimationFrame (aguarda Portal montar)
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      });
    }
  }, [open]);

  const selectedProduct = products.find(product => product.nome === selectedValue);

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-xs h-7", className)}
          onFocus={() => setOpen(true)}
        >
          {selectedProduct ? selectedProduct.nome : placeholder}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[300px] p-0 z-[9999] bg-popover border shadow-lg"
        sideOffset={4}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <Command shouldFilter={false} className="flex flex-col">
          <CommandInput 
            ref={inputRef}
            placeholder="Buscar produto..." 
            className="h-8 text-xs" 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList 
            className="max-h-[200px] overflow-y-auto overscroll-contain touch-pan-y"
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandEmpty className="text-xs py-2">
              Nenhum produto encontrado.
            </CommandEmpty>
            <CommandGroup>
              {filteredProducts.map((product) => {
                const valorProduto = getProductValue(product);
                
                return (
                  <CommandItem
                    key={product.id}
                    value={product.nome}
                    onSelect={() => {
                      onSelect(product);
                      setSelectedValue("");
                      setSearchTerm("");
                      setOpen(false);
                    }}
                    className="text-xs cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        selectedValue === product.nome ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{product.nome}</span>
                      <span className="text-2xs text-muted-foreground">
                        R$ {valorProduto.toFixed(2)}
                        {product.categoria && ` • ${product.categoria}`}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}