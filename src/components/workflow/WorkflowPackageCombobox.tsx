import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { configurationService } from '@/services/ConfigurationService';

interface PackageComboboxProps {
  value?: string;
  onValueChange: (packageData: {
    id: string; // Add ID to the interface
    nome: string;
    valor: string;
    valorFotoExtra: string;
    categoria: string;
    produtosIncluidos?: Array<{
      produtoId: string;
      quantidade: number;
    }>;
  }) => void;
  disabled?: boolean;
}

// Função utilitária para buscar categoria por ID
const getCategoriaNameById = (categoriaId: string | number, configCategorias: any[]): string => {
  if (!categoriaId || !configCategorias.length) return '';
  
  const categoria = configCategorias.find((cat: any) => 
    cat.id === categoriaId || cat.id === String(categoriaId)
  );
  
  if (categoria) {
    return categoria.nome || String(categoriaId);
  }
  
  const index = parseInt(String(categoriaId)) - 1;
  if (index >= 0 && index < configCategorias.length) {
    return configCategorias[index].nome || String(categoriaId);
  }
  
  return String(categoriaId);
};

export function WorkflowPackageCombobox({
  value,
  onValueChange,
  disabled = false
}: PackageComboboxProps) {
  const [open, setOpen] = useState(false);
  const [pacotes, setPacotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Load packages asynchronously
  useEffect(() => {
    const loadPackages = async () => {
      try {
        setLoading(true);
        const storedPacotes = configurationService.loadPacotes();
        const configCategorias = configurationService.loadCategorias();
        
        const processedPacotes = storedPacotes.map((pacote: any) => {
          let categoria = pacote.categoria || '';
          if (pacote.categoria_id) {
            categoria = getCategoriaNameById(pacote.categoria_id, configCategorias);
          }

          return {
            id: pacote.id,
            nome: pacote.nome,
            valor: pacote.valorVenda || pacote.valor_base || pacote.valor || 0,
            categoria,
            valorFotoExtra: pacote.valor_foto_extra || pacote.valorFotoExtra || 35,
            produtosIncluidos: pacote.produtosIncluidos || []
          };
        });
        
        setPacotes(processedPacotes);
      } catch (error) {
        console.error('Error loading packages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPackages();
  }, []);
  
  // Função para limpar a seleção
  const handleClearPackage = () => {
    onValueChange({
      id: '',
      nome: '',
      valor: 'R$ 0,00',
      valorFotoExtra: 'R$ 0,00',
      categoria: '',
      produtosIncluidos: []
    });
    setOpen(false);
  };
  
  // Find selected package by ID or name for flexibility
  const selectedPackage = pacotes.find(pkg => pkg.id === value || pkg.nome === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open} 
          disabled={disabled}
          className="w-full justify-between h-7 text-xs font-normal shadow-neumorphic hover:shadow-neumorphic-pressed disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selectedPackage ? selectedPackage.nome : "Selecione"}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 shadow-neumorphic border-0 bg-neumorphic-base z-[9999]">
        <Command className="bg-neumorphic-base">
          <CommandInput placeholder="Buscar pacote..." className="h-8 text-xs border-0 bg-transparent focus:ring-0" />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-muted-foreground">
              {loading ? 'Carregando pacotes...' : 'Nenhum pacote encontrado.'}
            </CommandEmpty>
            <CommandGroup>
              {/* Opção para limpar seleção */}
              <CommandItem 
                value="nenhum-pacote"
                onSelect={handleClearPackage}
                className="text-xs hover:bg-neumorphic-base hover:shadow-neumorphic-inset rounded cursor-pointer"
              >
                <Check className={cn("mr-2 h-3 w-3", !value ? "opacity-100" : "opacity-0")} />
                <span className="font-medium">Nenhum pacote</span>
              </CommandItem>
              {pacotes.map(pkg => (
                <CommandItem 
                  key={pkg.id} 
                  value={pkg.nome} 
                  onSelect={(currentValue) => {
                    const isSelected = pkg.id === value || pkg.nome === value;
                    if (!isSelected) {
                      onValueChange({
                        id: pkg.id, // Include package ID
                        nome: pkg.nome,
                        valor: `R$ ${(pkg.valor || 0).toFixed(2).replace('.', ',')}`,
                        valorFotoExtra: `R$ ${(pkg.valorFotoExtra || 35).toFixed(2).replace('.', ',')}`,
                        categoria: pkg.categoria,
                        produtosIncluidos: pkg.produtosIncluidos || []
                      });
                    }
                    setOpen(false);
                  }}
                  className="text-xs hover:bg-neumorphic-base hover:shadow-neumorphic-inset rounded cursor-pointer"
                >
                  <Check className={cn("mr-2 h-3 w-3", (pkg.id === value || pkg.nome === value) ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{pkg.nome}</span>
                    <span className="text-2xs text-muted-foreground">
                      R$ {(pkg.valor || 0).toFixed(2).replace('.', ',')} • Categoria: {pkg.categoria}
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