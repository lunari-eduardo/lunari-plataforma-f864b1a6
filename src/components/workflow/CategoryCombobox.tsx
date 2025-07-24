
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CategoryComboboxProps {
  value?: string;
  disabled?: boolean;
  categoryOptions?: { id: string; nome: string }[];
  onValueChange?: (categoria: string) => void;
}

export function CategoryCombobox({ 
  value, 
  disabled = false,
  categoryOptions = [],
  onValueChange
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  
  const selectedCategory = categoryOptions.find(cat => cat.nome === value);

  if (disabled || !onValueChange) {
    return (
      <Button
        variant="outline"
        disabled={true}
        className="w-full justify-start h-7 text-xs font-normal shadow-neumorphic-inset bg-gray-50 cursor-not-allowed"
      >
        {value || "Categoria"}
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open}
          className="w-full justify-between h-7 text-xs font-normal shadow-neumorphic hover:shadow-neumorphic-pressed"
        >
          {selectedCategory ? selectedCategory.nome : "Selecionar categoria..."}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 shadow-neumorphic border-0 bg-neumorphic-base z-[9999]">
        <Command className="bg-neumorphic-base">
          <CommandInput placeholder="Buscar categoria..." className="h-8 text-xs border-0 bg-transparent focus:ring-0" />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-neumorphic-textLight">
              Nenhuma categoria encontrada.
            </CommandEmpty>
            <CommandGroup className="bg-neutral-50">
              {categoryOptions.map(categoria => (
                <CommandItem 
                  key={categoria.id} 
                  value={categoria.nome} 
                  onSelect={(currentValue) => {
                    if (currentValue !== value) {
                      onValueChange?.(categoria.nome);
                    }
                    setOpen(false);
                  }} 
                  className="text-xs hover:bg-neumorphic-base hover:shadow-neumorphic-inset rounded cursor-pointer"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === categoria.nome ? "opacity-100" : "opacity-0")} />
                  <span className="font-medium">{categoria.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
