import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { ChevronDown, ShoppingBag, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sortProdutos } from '@/utils/produtoSort';
import { cn } from '@/lib/utils';

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '');
};

export interface ProductComboboxItem {
  id: string;
  nome: string;
  custo: number;
  valorVenda: number;
  favorito?: boolean;
  favorited_at?: string | null;
}

interface ProductSearchComboboxProps {
  onSelect: (product: ProductComboboxItem | null) => void;
  placeholder?: string;
}

export default function ProductSearchCombobox({
  onSelect,
  placeholder = "Buscar produto..."
}: ProductSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<ProductComboboxItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('produtos')
        .select('id, nome, preco_custo, preco_venda, favorito, favorited_at')
        .eq('user_id', user.id)
        .order('nome');
      if (data) {
        const mapped: ProductComboboxItem[] = data.map((p: any) => ({
          id: p.id,
          nome: p.nome,
          custo: Number(p.preco_custo) || 0,
          valorVenda: Number(p.preco_venda) || 0,
          favorito: Boolean(p.favorito),
          favorited_at: p.favorited_at ?? null,
        }));
        setProducts([...mapped].sort(sortProdutos));
      }
    };
    load();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProducts = searchTerm
    ? products.filter(p => normalizeText(p.nome).includes(normalizeText(searchTerm)))
    : products;

  const handleSelect = (product: ProductComboboxItem) => {
    onSelect(product);
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="pr-8 text-xs"
          autoComplete="off"
        />
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 dropdown-solid border border-border rounded-md shadow-lg max-h-60 overflow-auto scrollbar-minimal">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => handleSelect(product)}
                className="px-3 py-2 dropdown-solid-item cursor-pointer text-xs border-b border-border last:border-b-0"
              >
                <div className="flex items-center">
                  {product.favorito ? (
                    <Star className="h-3 w-3 mr-2 fill-amber-400 text-amber-500 shrink-0" />
                  ) : (
                    <ShoppingBag className="h-3 w-3 mr-2 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className={cn('font-medium', product.favorito && 'text-foreground')}>{product.nome}</span>
                    <div className="text-[11px] text-muted-foreground">
                      R$ {product.valorVenda.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Nenhum produto encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
