import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, X, Package } from 'lucide-react';
import { formatarMoeda } from '@/utils/precificacaoUtils';
import { useDialogDropdownContext } from '@/components/ui/dialog';
import type { Produto, ProdutoIncluido } from '@/types/configuration';

interface ProdutoSelectorImprovedProps {
  produtos: Produto[];
  produtosIncluidos: ProdutoIncluido[];
  onAdd: (produtoId: string) => void;
  onRemove: (produtoId: string) => void;
  onUpdateQuantity?: (produtoId: string, quantidade: number) => void;
  disabled?: boolean;
}

export default function ProdutoSelectorImproved({
  produtos,
  produtosIncluidos,
  onAdd,
  onRemove,
  onUpdateQuantity,
  disabled = false
}: ProdutoSelectorImprovedProps) {
  const [open, setOpen] = useState(false);
  const dialogDropdownContext = useDialogDropdownContext();

  // Register dropdown state with dialog context when available
  useEffect(() => {
    if (dialogDropdownContext) {
      dialogDropdownContext.setHasOpenDropdown(open);
    }
  }, [open, dialogDropdownContext]);

  const produtosDisponiveis = produtos.filter(
    produto => !produtosIncluidos.some(p => p.produtoId === produto.id)
  );

  const getProdutoNome = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    return produto?.nome || 'Produto não encontrado';
  };

  const getProdutoPreco = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    return produto?.preco_venda || 0;
  };

  const handleAdd = (produtoId: string) => {
    onAdd(produtoId);
    setOpen(false);
  };

  const handleQuantityChange = (produtoId: string, delta: number) => {
    const produto = produtosIncluidos.find(p => p.produtoId === produtoId);
    if (!produto || !onUpdateQuantity) return;

    const novaQuantidade = Math.max(1, produto.quantidade + delta);
    onUpdateQuantity(produtoId, novaQuantidade);
  };

  return (
    <div className="space-y-3">
      {/* Lista de produtos incluídos */}
      {produtosIncluidos.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground font-medium">
            Produtos Incluídos ({produtosIncluidos.length})
          </span>
          <div className="space-y-1.5">
            {produtosIncluidos.map((item) => (
              <div 
                key={item.produtoId} 
                className="flex items-center justify-between p-2 bg-lunar-accent/5 rounded-md border border-lunar-accent/10 group hover:border-lunar-accent/20 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Package className="h-3.5 w-3.5 text-lunar-accent flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">
                      {getProdutoNome(item.produtoId)}
                    </div>
                    <div className="text-2xs text-muted-foreground">
                      {formatarMoeda(getProdutoPreco(item.produtoId))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {onUpdateQuantity && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => handleQuantityChange(item.produtoId, -1)}
                        disabled={disabled || item.quantidade <= 1}
                      >
                        -
                      </Button>
                      <Badge variant="outline" className="text-2xs px-1.5 py-0.5 min-w-[28px] text-center">
                        {item.quantidade}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => handleQuantityChange(item.produtoId, 1)}
                        disabled={disabled}
                      >
                        +
                      </Button>
                    </div>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemove(item.produtoId)}
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão para adicionar produtos */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-9 text-xs border-dashed border-lunar-border hover:border-lunar-accent hover:bg-lunar-accent/5"
            disabled={disabled || produtosDisponiveis.length === 0}
          >
            <Plus className="h-3.5 w-3.5" />
            {produtosDisponiveis.length === 0 
              ? "Todos os produtos foram adicionados"
              : "Adicionar produto"
            }
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 z-[9999] bg-popover border shadow-lg" align="start">
          <Command>
            <CommandInput 
              placeholder="Buscar produto..." 
              className="h-8 text-xs"
            />
            <CommandList>
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                Nenhum produto encontrado.
              </CommandEmpty>
              <CommandGroup>
                {produtosDisponiveis.map((produto) => (
                  <CommandItem
                    key={produto.id}
                    value={produto.nome}
                    onSelect={() => handleAdd(produto.id)}
                    className="text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Package className="h-4 w-4 text-lunar-accent flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate">
                          {produto.nome}
                        </div>
                        <div className="text-2xs text-muted-foreground">
                          {formatarMoeda(produto.preco_venda)}
                        </div>
                      </div>
                    </div>
                    <Plus className="h-3.5 w-3.5 text-lunar-accent ml-2 flex-shrink-0" />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Estado vazio */}
      {produtosIncluidos.length === 0 && (
        <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-lunar-border rounded-md bg-muted/30">
          Nenhum produto incluído neste pacote
        </div>
      )}
    </div>
  );
}