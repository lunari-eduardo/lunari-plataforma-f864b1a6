
import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Product {
  id: string;
  nome: string;
  custo: number;
  valorVenda: number;
}

interface ProductSelectorProps {
  value?: string;
  onSelect: (product: Product | null) => void;
  className?: string;
}

// Mock data - in real app, this would come from the database
const mockProducts: Product[] = [
  { id: '1', nome: 'Álbum Premium 20x30', custo: 45.00, valorVenda: 120.00 },
  { id: '2', nome: 'Pen Drive Personalizado', custo: 25.00, valorVenda: 80.00 },
  { id: '3', nome: 'Impressão 15x21 (kit 50)', custo: 35.00, valorVenda: 90.00 },
  { id: '4', nome: 'Moldura Digital', custo: 120.00, valorVenda: 280.00 },
  { id: '5', nome: 'Canvas 40x60cm', custo: 85.00, valorVenda: 220.00 },
];

export function ProductSelector({ value, onSelect, className }: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // In a real app, this would fetch from the database
    setProducts(mockProducts);
  }, []);

  const selectedProduct = products.find(product => product.nome === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-xs h-7", className)}
        >
          {selectedProduct ? selectedProduct.nome : "Selecionar produto..."}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Buscar produto..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-2">
              Nenhum produto encontrado.
            </CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.nome}
                  onSelect={() => {
                    onSelect(selectedProduct?.nome === product.nome ? null : product);
                    setOpen(false);
                  }}
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
                    <span className="text-2xs text-gray-500">
                      Custo: R$ {product.custo.toFixed(2)} | Venda: R$ {product.valorVenda.toFixed(2)}
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
