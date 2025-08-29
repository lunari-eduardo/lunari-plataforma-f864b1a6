
import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { storage } from '@/utils/localStorage';

interface Product {
  id: string;
  nome: string;
  custo?: number;
  valorVenda?: number;
  preco_custo?: number;
  preco_venda?: number;
}

interface ProductSelectorProps {
  value?: string;
  onSelect: (product: Product | null) => void;
  className?: string;
}

// Função utilitária para normalizar produtos
const normalizeProducts = (savedProducts: any[]): Product[] => {
  return savedProducts.map((produto: any) => ({
    id: produto.id || produto.uuid || `produto_${Date.now()}_${Math.random()}`,
    nome: produto.nome || produto.name || '',
    custo: Number(produto.preco_custo || produto.precocusto || produto.custo || 0),
    valorVenda: Number(produto.preco_venda || produto.precovenda || produto.valorVenda || produto.valor || 0)
  })).filter(produto => produto.nome.trim() !== '');
};

export function ProductSelector({ value, onSelect, className }: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = () => {
      try {
        const savedProducts = storage.load('configuracoes_produtos', []);
        console.log('🔍 [ProductSelector] Produtos salvos:', savedProducts);
        
        const convertedProducts = normalizeProducts(savedProducts);
        console.log('🔄 [ProductSelector] Produtos convertidos:', convertedProducts);
        console.log('🎯 [ProductSelector] Value atual:', value);
        
        setProducts(convertedProducts);
      } catch (error) {
        console.error('❌ [ProductSelector] Erro ao carregar produtos:', error);
        setProducts([]);
      }
    };

    loadProducts();
  }, []);

  // Encontrar o produto selecionado de forma mais robusta
  const selectedProduct = products.find(product => 
    product.nome === value || 
    product.id === value
  );

  console.log('🔍 [ProductSelector] Render:', {
    value,
    selectedProduct,
    productsCount: products.length,
    productNames: products.map(p => p.nome)
  });

  const handleSelect = useCallback((selectedProductName: string) => {
    console.log('🎯 [ProductSelector] handleSelect chamado:', selectedProductName);
    
    const product = products.find(p => p.nome === selectedProductName);
    console.log('🔍 [ProductSelector] Produto encontrado:', product);
    
    if (product) {
      // Se é o mesmo produto já selecionado, limpar
      if (value === product.nome) {
        console.log('🔄 [ProductSelector] Limpando seleção');
        onSelect(null);
      } else {
        console.log('🔄 [ProductSelector] Selecionando produto:', product);
        onSelect(product);
      }
    }
    
    setOpen(false);
  }, [products, value, onSelect]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-xs h-7", className)}
        >
          <span className="truncate">
            {selectedProduct ? selectedProduct.nome : "Selecionar produto"}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 bg-popover border-border z-50">
        <Command>
          <CommandInput placeholder="Buscar produto..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-2">
              {products.length === 0 
                ? "Nenhum produto cadastrado. Configure produtos primeiro."
                : "Nenhum produto encontrado."
              }
            </CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.nome}
                  onSelect={handleSelect}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      value === product.nome ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{product.nome}</span>
                    <span className="text-2xs text-muted-foreground">
                      Custo: R$ {(product.custo || 0).toFixed(2)} | Venda: R$ {(product.valorVenda || 0).toFixed(2)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
