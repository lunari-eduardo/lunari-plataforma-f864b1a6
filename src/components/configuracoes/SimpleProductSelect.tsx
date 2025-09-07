import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Produto } from '@/types/configuration';

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

  const handleValueChange = (value: string) => {
    if (value === "") {
      onSelect(null);
      setSelectedValue("");
      return;
    }

    const selectedProduct = products.find(p => p.id === value);
    if (selectedProduct) {
      onSelect(selectedProduct);
      setSelectedValue(""); // Reset after selection
    }
  };

  return (
    <Select value={selectedValue} onValueChange={handleValueChange}>
      <SelectTrigger className={`${className} text-sm`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[200px]">
        {products.length === 0 ? (
          <SelectItem value="no-products" disabled>
            Nenhum produto disponível
          </SelectItem>
        ) : (
          products.map((product) => (
            <SelectItem key={product.id} value={product.id} className="text-sm">
              <div className="flex flex-col">
                <span className="font-medium">{product.nome}</span>
                <span className="text-xs text-muted-foreground">
                  R$ {product.preco_venda?.toFixed(2) || '0,00'}
                </span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}