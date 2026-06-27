import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ProductSearchCombobox, { ProductComboboxItem } from "@/components/agenda/ProductSearchCombobox";

const handleNumberInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  setTimeout(() => e.target.select(), 0);
};

export interface ManualProduct {
  produtoId?: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

interface Props {
  produtos: ManualProduct[];
  onSelectProduct: (index: number, product: ProductComboboxItem | null) => void;
  onQtyChange: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  formatCurrency: (v: any) => string;
}

export function QuickSessionProductsList({
  produtos, onSelectProduct, onQtyChange, onRemove, onAdd, formatCurrency,
}: Props) {
  return (
    <>
      {produtos.length > 0 && (
        <div className="space-y-2 p-3 border rounded-md bg-muted/30">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Produtos</Label>
            <span className="text-2xs text-muted-foreground">
              Selecione do cadastro · valor automático
            </span>
          </div>
          {produtos.map((produto, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6" data-quick-session-product>
                <ProductSearchCombobox
                  onSelect={(p) => onSelectProduct(index, p)}
                  placeholder={produto.nome || "Buscar produto..."}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={produto.quantidade}
                  onChange={(e) => onQtyChange(index, parseFloat(e.target.value) || 0)}
                  onFocus={handleNumberInputFocus}
                  placeholder="Qtd"
                  className="h-7 text-xs"
                  data-quick-session-qty={index}
                />
              </div>
              <div className="col-span-2 text-2xs text-muted-foreground text-right">
                {produto.valorUnitario > 0 ? `× ${formatCurrency(produto.valorUnitario)}` : "—"}
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <span className="text-xs font-semibold">
                  {formatCurrency(produto.quantidade * produto.valorUnitario)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(index)}
                  className="h-6 w-6 p-0"
                  title="Remover produto"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdd}
            className="w-full"
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar Produto
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">Atalho: Ctrl + P</span>
        </TooltipContent>
      </Tooltip>
    </>
  );
}
