import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star } from 'lucide-react';
import { Produto } from '@/types/configuration';
import { sortProdutos } from '@/utils/produtoSort';

interface SimpleProductSelectProps {
  products: Produto[];
  onSelect: (product: Produto | null) => void;
  placeholder?: string;
  className?: string;
}

export default function SimpleProductSelect({
  products,
  onSelect,
  placeholder = "Selecionar produto...",
  className = ""
}: SimpleProductSelectProps) {
  const [selectedValue, setSelectedValue] = useState<string>("");

  const ordenados = useMemo(() => [...products].sort(sortProdutos), [products]);

  const handleValueChange = (value: string) => {
    if (value === "") {
      onSelect(null);
      setSelectedValue("");
      return;
    }
    const selectedProduct = ordenados.find(p => p.id === value);
    if (selectedProduct) {
      onSelect(selectedProduct);
      setSelectedValue("");
    }
  };

  return (
    <Select value={selectedValue} onValueChange={handleValueChange}>
      <SelectTrigger className={`${className} text-sm`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[200px]">
        {ordenados.length === 0 ? (
          <SelectItem value="no-products" disabled>
            Nenhum produto disponível
          </SelectItem>
        ) : (
          ordenados.map((product) => (
            <SelectItem key={product.id} value={product.id} className="text-sm">
              <div className="flex items-center gap-2">
                {product.favorito && <Star className="h-3 w-3 fill-amber-400 text-amber-500 shrink-0" />}
                <div className="flex flex-col">
                  <span className="font-medium">{product.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    R$ {product.preco_venda?.toFixed(2) || '0,00'}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
