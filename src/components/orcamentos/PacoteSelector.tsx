import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOrcamentoData } from "@/hooks/useOrcamentoData";

interface PacoteSelectorProps {
  value?: string;
  onValueChange: (packageData: {
    id: string;
    nome: string;
    valor: number;
    categoria: string;
    produtosIncluidos?: any[];
  } | null) => void;
  placeholder?: string;
  className?: string;
  filtrarPorCategoria?: string;
}

export function PacoteSelector({
  value,
  onValueChange,
  placeholder = "Selecionar pacote...",
  className,
  filtrarPorCategoria
}: PacoteSelectorProps) {
  const [open, setOpen] = useState(false);
  const { pacotes } = useOrcamentoData();

  // Filtrar pacotes por categoria se especificada
  const pacotesFiltrados = filtrarPorCategoria && filtrarPorCategoria.trim() !== ''
    ? pacotes.filter(pacote => pacote.categoria === filtrarPorCategoria)
    : pacotes;

  const selectedPackage = value ? pacotes.find(pkg => pkg.nome === value) : null;

  const handleSelect = (pacote: any) => {
    onValueChange({
      id: pacote.id,
      nome: pacote.nome,
      valor: pacote.valor,
      categoria: pacote.categoria,
      produtosIncluidos: pacote.produtosIncluidos || []
    });
    setOpen(false);
  };

  const handleClear = () => {
    onValueChange(null);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", className)}
          >
            {selectedPackage ? (
              <span className="flex items-center gap-2">
                {selectedPackage.nome}
                <span className="text-xs text-muted-foreground">
                  ({selectedPackage.categoria})
                </span>
              </span>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 z-[9999] bg-white border shadow-lg">
          <Command>
            <CommandInput placeholder="Buscar pacote..." />
            <CommandList>
              <CommandEmpty>
                Nenhum pacote encontrado.
              </CommandEmpty>
              <CommandGroup>
                {/* Opção para limpar seleção */}
                <CommandItem
                  value="nenhum-pacote"
                  onSelect={handleClear}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !selectedPackage ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-medium text-muted-foreground">Nenhum pacote</span>
                </CommandItem>
                
                {pacotesFiltrados.map((pacote) => (
                  <CommandItem
                    key={pacote.id}
                    value={pacote.nome}
                    onSelect={() => handleSelect(pacote)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedPackage?.id === pacote.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col w-full">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{pacote.nome}</span>
                        <span className="text-sm font-medium text-green-600">
                          R$ {pacote.valor.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{pacote.categoria}</span>
                        {pacote.produtosIncluidos && pacote.produtosIncluidos.length > 0 && (
                          <span>{pacote.produtosIncluidos.length} produto(s) incluso(s)</span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Botão X para limpar quando há seleção */}
      {selectedPackage && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-8 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted/50"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}