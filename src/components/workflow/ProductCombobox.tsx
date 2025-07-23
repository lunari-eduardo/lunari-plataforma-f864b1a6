
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ProductOption {
  id: string;
  nome: string;
  valor: string;
}

interface ProductComboboxProps {
  value?: string;
  onValueChange: (productData: {
    nome: string;
    valor: string;
  } | null) => void;
  productOptions: ProductOption[];
  onClear?: () => void;
}

export function ProductCombobox({
  value,
  onValueChange,
  productOptions,
  onClear
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  
  const selectedProduct = productOptions.find(product => product.nome === value);
  const hasValue = value && value.trim() !== '';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Backspace' || e.key === 'Delete') && hasValue) {
      e.preventDefault();
      e.stopPropagation();
      onValueChange(null);
      if (onClear) {
        onClear();
      }
    }
  };

  const handleSelectProduct = (product: any) => {
    onValueChange({
      nome: product.nome,
      valor: product.valor
    });
    setOpen(false);
  };

  const handleSelectNone = () => {
    onValueChange(null);
    if (onClear) {
      onClear();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          onKeyDown={handleKeyDown}
          className="w-full justify-between h-7 text-xs font-normal shadow-neumorphic hover:shadow-neumorphic-pressed relative"
        >
          <span className="truncate">
            {selectedProduct ? selectedProduct.nome : ''}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0 shadow-neumorphic border-0 bg-neumorphic-base z-[9999]">
        <Command className="bg-neumorphic-base">
          <CommandInput 
            placeholder="Buscar produto..." 
            className="h-8 text-xs border-0 bg-transparent focus:ring-0" 
          />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-neumorphic-textLight">
              Nenhum produto encontrado.
            </CommandEmpty>
            <CommandGroup className="bg-neutral-50">
              <CommandItem
                value="__none__"
                onSelect={handleSelectNone}
                className="text-xs hover:bg-neumorphic-base hover:shadow-neumorphic-inset rounded cursor-pointer border-b border-gray-200"
              >
                <Check
                  className={cn(
                    "mr-2 h-3 w-3",
                    !hasValue ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="font-medium text-gray-500">Nenhum produto</span>
              </CommandItem>
              {productOptions.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.nome}
                  onSelect={() => handleSelectProduct(product)}
                  className="text-xs hover:bg-neumorphic-base hover:shadow-neumorphic-inset rounded cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      value === product.nome ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{product.nome}</span>
                    <span className="text-2xs text-neumorphic-textLight">
                      {product.valor}
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
