import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [selectedValue, setSelectedValue] = useState("");

  const selectedProduct = products.find(product => product.nome === selectedValue);

  const getProductValue = (product: Product): number => {
    return product.valorVenda || product.preco_venda || product.valor || 0;
  };

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
        className="w-[300px] p-0 z-[60] dropdown-solid border shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar produto..." 
            className="h-8 text-xs" 
            autoFocus
          />
          <CommandList>
            <CommandEmpty className="text-xs py-2">
              Nenhum produto encontrado.
            </CommandEmpty>
            <CommandGroup>
              {products.map((product) => {
                const valorProduto = getProductValue(product);
                
                return (
                  <CommandItem
                    key={product.id}
                    value={product.nome}
                    onSelect={(currentValue) => {
                      const selected = products.find(p => p.nome === currentValue);
                      if (selected) {
                        onSelect(selected);
                        setSelectedValue("");
                      }
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