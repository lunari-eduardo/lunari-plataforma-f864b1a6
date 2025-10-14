import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { storage } from '@/utils/localStorage';
import { processProductList, debugProductData, type NormalizedProduct } from '@/utils/productUtils';
interface SimpleProductSelectorProps {
  value?: string;
  onSelect: (product: NormalizedProduct | null) => void;
  className?: string;
}
export function SimpleProductSelector({
  value,
  onSelect,
  className
}: SimpleProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<NormalizedProduct[]>([]);
  const [selectedValue, setSelectedValue] = useState(""); // Add internal state like ProductSearchCombobox

  useEffect(() => {
    console.log('📦 [SimpleProductSelector] Carregando produtos...');
    try {
      const savedProducts = storage.load('configuracoes_produtos', []);
      console.log('📊 [SimpleProductSelector] Produtos salvos encontrados:', savedProducts.length);

      // Debug raw data
      debugProductData(savedProducts, 'SimpleProductSelector');

      // Process using utility function
      const processedProducts = processProductList(savedProducts);
      console.log('✅ [SimpleProductSelector] Produtos processados:', processedProducts.length);
      setProducts(processedProducts);
    } catch (error) {
      console.error('❌ [SimpleProductSelector] Erro ao carregar produtos:', error);
      setProducts([]);
    }
  }, []);
  const selectedProduct = products.find(product => product.nome === value);
  const handleSelect = (selectedProductName: string) => {
    console.log('🎯 SimpleProductSelector: handleSelect chamado', {
      selectedProductName
    });
    try {
      const product = products.find(p => p.nome === selectedProductName);
      console.log('📦 Produto encontrado:', product);
      if (product) {
        console.log('✅ Enviando produto selecionado:', product);
        onSelect(product);
        setSelectedValue(""); // Reset after selection like ProductSearchCombobox
      } else {
        console.log('⚠️ Produto não encontrado, enviando null');
        onSelect(null);
      }
      setOpen(false);
    } catch (error) {
      console.error('❌ Erro na seleção de produto:', error);
      setOpen(false);
    }
  };
  return <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-8 text-xs bg-background border border-input hover:bg-accent hover:text-accent-foreground",
            className
          )}
        >
          {selectedValue || value || "Selecionar produto..."}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 z-[9999] dropdown-solid border shadow-lg">
        <Command>
          <CommandInput placeholder="Buscar produto..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-2">
              {products.length === 0 ? "Nenhum produto cadastrado. Configure produtos primeiro." : "Nenhum produto encontrado."}
            </CommandEmpty>
            <CommandGroup>
              {products.map(product => <CommandItem key={product.id} value={product.nome} onSelect={handleSelect} className="text-xs cursor-pointer">
                  <Check className={cn("mr-2 h-3 w-3", value === product.nome ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{product.nome}</span>
                    <span className="text-2xs text-muted-foreground">
                      Custo: R$ {(product.custo || 0).toFixed(2)} | Venda: R$ {(product.valorVenda || 0).toFixed(2)}
                    </span>
                  </div>
                </CommandItem>)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>;
}