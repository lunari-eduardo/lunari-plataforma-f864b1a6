/**
 * Componente de seleção de categoria com loading state
 * Usado no formulário de agendamento e outros locais
 */

import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { Categoria } from '@/types/configuration';

interface CategoriaSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CategoriaSelect({ 
  value, 
  onValueChange, 
  placeholder = "Selecione uma categoria",
  className 
}: CategoriaSelectProps) {
  const { categorias, isLoadingCategorias } = useRealtimeConfiguration();

  if (isLoadingCategorias) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {categorias.map((categoria) => (
          <SelectItem key={categoria.id} value={categoria.id}>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: categoria.cor }}
              />
              {categoria.nome}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Hook para buscar categoria por ID
 */
export function useCategoriaById(categoriaId?: string): Categoria | undefined {
  const { categorias, isLoadingCategorias } = useRealtimeConfiguration();
  
  if (isLoadingCategorias || !categoriaId) {
    return undefined;
  }
  
  return categorias.find(cat => cat.id === categoriaId);
}