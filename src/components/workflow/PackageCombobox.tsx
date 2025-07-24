import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOrcamentoData } from "@/hooks/useOrcamentoData";
interface PackageComboboxProps {
  value?: string;
  onValueChange: (packageData: {
    nome: string;
    valor: string;
    valorFotoExtra: string;
    categoria: string;
  }) => void;
  disabled?: boolean;
}
export function PackageCombobox({
  value,
  onValueChange,
  disabled = false
}: PackageComboboxProps) {
  const [open, setOpen] = useState(false);
  const { pacotes } = useOrcamentoData();
  
  const selectedPackage = pacotes.find(pkg => pkg.nome === value);
  return <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open} 
          disabled={disabled}
          className="w-full justify-between h-7 text-xs font-normal shadow-neumorphic hover:shadow-neumorphic-pressed disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selectedPackage ? selectedPackage.nome : "Selecionar pacote..."}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 shadow-neumorphic border-0 bg-neumorphic-base z-[9999]">
        <Command className="bg-neumorphic-base">
          <CommandInput placeholder="Buscar pacote..." className="h-8 text-xs border-0 bg-transparent focus:ring-0" />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-neumorphic-textLight">
              Nenhum pacote encontrado.
            </CommandEmpty>
            <CommandGroup className="bg-neutral-50">
              {pacotes.map(pkg => <CommandItem key={pkg.id} value={pkg.nome} onSelect={currentValue => {
              if (currentValue !== value) {
                onValueChange({
                  nome: pkg.nome,
                  valor: `R$ ${pkg.valor.toFixed(2).replace('.', ',')}`,
                  valorFotoExtra: `R$ ${(pkg.valorFotoExtra || 35).toFixed(2).replace('.', ',')}`,
                  categoria: pkg.categoria
                });
              }
              setOpen(false);
            }} className="text-xs hover:bg-neumorphic-base hover:shadow-neumorphic-inset rounded cursor-pointer">
                  <Check className={cn("mr-2 h-3 w-3", value === pkg.nome ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{pkg.nome}</span>
                    <span className="text-2xs text-neumorphic-textLight">
                      R$ {pkg.valor.toFixed(2).replace('.', ',')} • Categoria: {pkg.categoria}
                    </span>
                  </div>
                </CommandItem>)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>;
}