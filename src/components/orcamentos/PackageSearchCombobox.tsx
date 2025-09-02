
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { configurationService } from '@/services/ConfigurationService';

interface Pacote {
  id: string;
  nome: string;
  valor_base?: number;
  valor?: number;
  valorVenda?: number;
  categoria_id?: string;
  categoria?: string;
}

interface PackageSearchComboboxProps {
  pacotes: Pacote[];
  value?: Pacote | null;
  onSelect: (pacote: Pacote | null) => void;
  placeholder?: string;
  className?: string;
  filtrarPorCategoria?: string;
}

export function PackageSearchCombobox({
  pacotes,
  value,
  onSelect,
  placeholder = "Selecionar pacote...",
  className,
  filtrarPorCategoria
}: PackageSearchComboboxProps) {
  const [open, setOpen] = useState(false);

  // Função para resolver categoria por ID
  const getCategoriaById = (categoriaId: string | number): string => {
    if (!categoriaId) return '';
    
    // Tentar carregar configurações do service
    let configCategorias = [];
    try {
      configCategorias = configurationService.loadCategorias();
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
    
    // Buscar categoria por ID
    const categoria = configCategorias.find((cat) => 
      cat.id === categoriaId || cat.id === String(categoriaId)
    );
    
    if (categoria) {
      return categoria.nome || String(categoriaId);
    }
    
    // Fallback: usar index-based lookup
    const index = parseInt(String(categoriaId)) - 1;
    if (index >= 0 && index < configCategorias.length) {
      return configCategorias[index].nome || String(categoriaId);
    }
    
    return String(categoriaId);
  };

  // Filtrar pacotes por categoria se especificada
  const pacotesFiltrados = filtrarPorCategoria && filtrarPorCategoria.trim() !== ''
    ? pacotes.filter(pacote => {
        // Comparar categoria direta ou resolver categoria_id
        let categoriaResolve = pacote.categoria || '';
        
        if (!categoriaResolve && pacote.categoria_id) {
          categoriaResolve = getCategoriaById(pacote.categoria_id);
        }
        
        return categoriaResolve === filtrarPorCategoria;
      })
    : pacotes;

  const getPackageValue = (pacote: Pacote) => {
    return pacote.valorVenda || pacote.valor_base || pacote.valor || 0;
  };

  const getPackageDisplay = (pacote: Pacote) => {
    const valor = getPackageValue(pacote);
    let categoria = pacote.categoria || '';
    
    // Resolver categoria por ID se necessário
    if (!categoria && pacote.categoria_id) {
      categoria = getCategoriaById(pacote.categoria_id);
    }
    
    return `${pacote.nome} - R$ ${valor.toFixed(2)}${categoria ? ` (${categoria})` : ''}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {value ? getPackageDisplay(value) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 z-[9999] bg-popover border shadow-lg">
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
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="font-medium text-muted-foreground">Nenhum pacote</span>
              </CommandItem>
              
              {pacotesFiltrados.map((pacote) => {
                let categoria = pacote.categoria || '';
                if (!categoria && pacote.categoria_id) {
                  categoria = getCategoriaById(pacote.categoria_id);
                }
                
                return (
                  <CommandItem
                    key={pacote.id}
                    value={pacote.nome}
                    onSelect={(currentValue) => {
                      console.log('PackageSearchCombobox: onSelect chamado', { pacote, currentValue });
                      // Chama a função de callback do pai com o pacote selecionado
                      onSelect(pacote);
                      // Fecha o menu após seleção
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value?.id === pacote.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{pacote.nome}</span>
                      <span className="text-sm text-muted-foreground">
                        R$ {getPackageValue(pacote).toFixed(2)}
                        {categoria && ` • ${categoria}`}
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
