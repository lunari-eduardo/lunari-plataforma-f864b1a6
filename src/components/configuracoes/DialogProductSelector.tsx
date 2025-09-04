import { ProductSearchCombobox } from "@/components/ui/product-search-combobox";

interface Product {
  id: string;
  nome: string;
  custo?: number;
  valorVenda?: number;
  preco_venda?: number;
  valor?: number;
  categoria?: string;
}

interface DialogProductSelectorProps {
  products: Product[];
  onSelect: (product: Product | null) => void;
  placeholder?: string;
  className?: string;
}

export function DialogProductSelector({
  products,
  onSelect,
  placeholder = "Adicionar produto...",
  className
}: DialogProductSelectorProps) {
  return (
    <ProductSearchCombobox
      products={products}
      onSelect={onSelect}
      placeholder={placeholder}
      className={className}
    />
  );
}