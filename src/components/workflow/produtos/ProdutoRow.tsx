import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";

export interface ProdutoWorkflow {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: "incluso" | "manual";
  produzido?: boolean;
  entregue?: boolean;
}

interface Props {
  produto: ProdutoWorkflow;
  index: number;
  onQuantidadeChange: (index: number, q: number) => void;
  onRemove: (index: number) => void;
  onSetFlag: (index: number, key: "produzido" | "entregue", value: boolean) => void;
  formatCurrency: (v: number | undefined | null) => string;
}

export function ProdutoRow({
  produto, index, onQuantidadeChange, onRemove, onSetFlag, formatCurrency,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-muted/50 rounded-lg border">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium truncate text-xs sm:text-sm" title={produto.nome}>
            {produto.nome}
          </span>
          {produto.tipo === "incluso" && (
            <Badge variant="secondary" className="text-xs">Incluso no pacote</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:text-xs text-muted-foreground">
          <span>
            Preço unit.: {produto.tipo === "incluso" ? "R$ 0,00 (incluso)" : formatCurrency(produto.valorUnitario)}
          </span>
          <span>
            Subtotal: {produto.tipo === "incluso" ? "R$ 0,00 (incluso)" : formatCurrency(produto.valorUnitario * produto.quantidade)}
          </span>
        </div>
      </div>

      <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Checkbox
              id={`prod-${index}`}
              checked={!!produto.produzido}
              onCheckedChange={(checked) => onSetFlag(index, "produzido", !!checked)}
              className="h-4 w-4"
            />
            <Label htmlFor={`prod-${index}`} className="text-[11px]">Produção</Label>
          </div>
          <div className="flex items-center gap-1">
            <Checkbox
              id={`ent-${index}`}
              checked={!!produto.entregue}
              onCheckedChange={(checked) => onSetFlag(index, "entregue", !!checked)}
              className="h-4 w-4"
            />
            <Label htmlFor={`ent-${index}`} className="text-[11px]">Entrega</Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Label className="text-[11px]">Qtd:</Label>
            <Input
              type="number"
              value={produto.quantidade}
              onChange={(e) => onQuantidadeChange(index, parseInt(e.target.value) || 0)}
              className="w-14 h-8 text-xs"
              min="0"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
