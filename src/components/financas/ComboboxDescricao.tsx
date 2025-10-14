
import { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComboboxDescricaoProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  descricoesConhecidas: string[];
  onNovaDescricao: (descricao: string) => void;
}

export default function ComboboxDescricao({
  value,
  onValueChange,
  placeholder = "Digite ou selecione uma descrição...",
  className,
  disabled = false,
  descricoesConhecidas,
  onNovaDescricao
}: ComboboxDescricaoProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setInputValue(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onValueChange(newValue);
    
    // Se o valor não está na lista e não está vazio, salva como nova descrição
    if (newValue && !descricoesConhecidas.includes(newValue)) {
      onNovaDescricao(newValue);
    }
  };

  const filteredDescricoes = descricoesConhecidas.filter(descricao =>
    descricao.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          disabled={disabled}
        >
          <span className="truncate">
            {inputValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 dropdown-solid border border-border shadow-lg z-50">
        <Command>
          <CommandInput
            placeholder="Digite para buscar ou criar nova descrição..."
            value={inputValue}
            onValueChange={handleInputChange}
            className="border-0"
          />
          <CommandList className="max-h-[200px] overflow-y-auto scrollbar-minimal">
            {filteredDescricoes.length > 0 ? (
              <CommandGroup>
                {filteredDescricoes.map((descricao) => (
                  <CommandItem
                    key={descricao}
                    value={descricao}
                    onSelect={() => handleSelect(descricao)}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === descricao ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {descricao}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                {inputValue 
                  ? `Pressione Enter para criar "${inputValue}"`
                  : "Nenhuma descrição encontrada."
                }
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
