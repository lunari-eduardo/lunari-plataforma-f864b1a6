import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { normalizeString } from '@/utils/stringNormalization';

interface NormalizedProduct {
  id: string;
  nome: string;
  custo: number;
  valorVenda: number;
}

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('📦 [SimpleProductSelector] Usuário não autenticado');
          setProducts([]);
          return;
        }

        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('user_id', user.id)
          .order('nome');

        if (error) {
          console.error('❌ [SimpleProductSelector] Erro ao carregar produtos:', error);
          setProducts([]);
          return;
        }

        const normalized: NormalizedProduct[] = (data || []).map(p => ({
          id: p.id,
          nome: p.nome,
          custo: Number(p.preco_custo) || 0,
          valorVenda: Number(p.preco_venda) || 0
        }));

        console.log('✅ [SimpleProductSelector] Produtos carregados do Supabase:', normalized.length);
        setProducts(normalized);
      } catch (error) {
        console.error('❌ [SimpleProductSelector] Erro ao carregar produtos:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const handleSelect = (selectedProductName: string) => {
    const product = products.find(p => p.nome === selectedProductName);
    if (product) {
      onSelect(product);
    } else {
      onSelect(null);
    }
    setOpen(false);
  };

  // Custom filter function for accent-insensitive search
  const filterProducts = (value: string, search: string) => {
    const normalizedValue = normalizeString(value);
    const normalizedSearch = normalizeString(search);
    return normalizedValue.includes(normalizedSearch) ? 1 : 0;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          {value || "Selecionar produto..."}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 z-[9999] bg-popover border shadow-lg">
        <Command filter={filterProducts}>
          <CommandInput placeholder="Buscar produto..." className="h-8 text-xs" />
          <CommandList className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-xs text-muted-foreground">Carregando...</span>
              </div>
            ) : (
              <>
                <CommandEmpty className="text-xs py-2">
                  {products.length === 0 
                    ? "Nenhum produto cadastrado. Configure produtos primeiro." 
                    : "Nenhum produto encontrado."}
                </CommandEmpty>
                <CommandGroup>
                  {products.map(product => (
                    <CommandItem 
                      key={product.id} 
                      value={product.nome} 
                      onSelect={handleSelect} 
                      className="text-xs cursor-pointer"
                    >
                      <Check className={cn("mr-2 h-3 w-3", value === product.nome ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span className="font-medium">{product.nome}</span>
                        <span className="text-2xs text-muted-foreground">
                          Custo: R$ {product.custo.toFixed(2)} | Venda: R$ {product.valorVenda.toFixed(2)}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Re-export the type for backwards compatibility
export type { NormalizedProduct };
