import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface CategorySelectorProps {
  categorias: string[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CategorySelector({ 
  categorias, 
  value, 
  onValueChange, 
  placeholder = "Selecione uma categoria",
  disabled = false
}: CategorySelectorProps) {
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange('');
  };

  return (
    <div className="relative">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {categorias.map(categoria => (
            <SelectItem key={categoria} value={categoria}>
              {categoria}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 p-0 hover:bg-muted"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}