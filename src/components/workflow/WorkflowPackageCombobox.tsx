import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfiguration } from '@/hooks/useConfiguration';

interface PackageComboboxProps {
  value?: string;
  displayName?: string; // Nome a exibir (congelado)
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
  displayName,
  onValueChange,
  disabled = false
}: PackageComboboxProps) {
  const [open, setOpen] = useState(false);
  
  // Use real-time configuration data from Supabase
  const { pacotes: rawPacotes, categorias, isLoadingPacotes } = useConfiguration();
  
  // Process packages with category names
  const pacotes = rawPacotes.map((pacote: any) => {
    let categoria = pacote.categoria || '';
    if (pacote.categoria_id) {
      categoria = getCategoriaNameById(pacote.categoria_id, categorias);
    }

    return {
      id: pacote.id,
      nome: pacote.nome,
      valor: pacote.valor_base || pacote.valorVenda || pacote.valor || 0,
      categoria,
      valorFotoExtra: pacote.valor_foto_extra || pacote.valorFotoExtra || 35,
      produtosIncluidos: pacote.produtos_incluidos || pacote.produtosIncluidos || []
    };
  });

  console.log('📦 WorkflowPackageCombobox - Packages loaded:', pacotes.length, 'packages');
  console.log('📦 WorkflowPackageCombobox - Current value:', value);
  console.log('📦 WorkflowPackageCombobox - Available packages:', pacotes);
  
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
  
  // Find selected package by ID first, then by name for flexibility
  const selectedPackage = pacotes.find(pkg => 
    pkg.id === value || 
    pkg.nome === value ||
    String(pkg.id) === String(value)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open} 
          disabled={disabled || isLoadingPacotes}
          className="w-full justify-between h-7 text-xs font-normal shadow-neumorphic hover:shadow-neumorphic-pressed disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingPacotes ? "Carregando..." : displayName || selectedPackage?.nome || "Selecione"}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 shadow-neumorphic border-0 bg-neumorphic-base z-[9999]">
        <Command className="bg-neumorphic-base">
          <CommandInput placeholder="Buscar pacote..." className="h-8 text-xs border-0 bg-neumorphic-base focus:ring-0" />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-muted-foreground">
              {isLoadingPacotes ? 'Carregando pacotes...' : 'Nenhum pacote encontrado.'}
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
                    // CORREÇÃO: Melhorar comparação de seleção
                    const isSelected = pkg.id === value || pkg.nome === value || String(pkg.id) === String(value);
                    if (!isSelected) {
                      console.log('📦 Selecionando pacote:', pkg.nome, 'ID:', pkg.id);
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
                  <Check className={cn("mr-2 h-3 w-3", (pkg.id === value || pkg.nome === value || String(pkg.id) === String(value)) ? "opacity-100" : "opacity-0")} />
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