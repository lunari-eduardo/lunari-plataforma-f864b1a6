import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { ProdutoFlowTimeline } from "./ProdutoFlowTimeline";
import { ProdutoFlowEditPopover } from "./ProdutoFlowEditPopover";
import {
  hydrateProduto,
  switchFluxo,
  toggleEtapaAt,
  type EtapaProducao,
  type ProdutoWorkflowFlow,
} from "@/features/workflow/domain/productFlow";

// Re-export para manter compatibilidade com imports existentes.
export type ProdutoWorkflow = ProdutoWorkflowFlow;

interface Props {
  produto: ProdutoWorkflowFlow;
  index: number;
  ultimoCustomNomes?: string[];
  onQuantidadeChange: (index: number, q: number) => void;
  onValorUnitarioChange: (index: number, v: number) => void;
  onRemove: (index: number) => void;
  onEtapasChange: (index: number, etapas: EtapaProducao[]) => void;
  onFluxoChange: (index: number, fluxo: "padrao" | "custom") => void;
  onCustomFlowSaved: (nomes: string[]) => void;
  formatCurrency: (v: number | undefined | null) => string;
}

export function ProdutoRow({
  produto,
  index,
  ultimoCustomNomes,
  onQuantidadeChange,
  onValorUnitarioChange,
  onRemove,
  onEtapasChange,
  onFluxoChange,
  onCustomFlowSaved,
  formatCurrency,
}: Props) {
  const hydrated = hydrateProduto(produto);
  const etapas = hydrated.etapas ?? [];
  const fluxo = hydrated.fluxo ?? "padrao";

  const valorInput = useCurrencyInput({
    value: produto.valorUnitario || 0,
    onChange: (v) => onValorUnitarioChange(index, v),
  });

  const isIncluso = produto.tipo === "incluso";
  const subtotal = isIncluso ? 0 : (produto.valorUnitario || 0) * (produto.quantidade || 0);

  return (
    <div className="flex flex-col gap-3 p-3 bg-muted/50 rounded-lg border">
      {/* Cabeçalho: nome + badge + qtd + remover */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium truncate text-xs sm:text-sm" title={produto.nome}>
              {produto.nome}
            </span>
            {isIncluso && (
              <Badge variant="secondary" className="text-[10px]">Incluso no pacote</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
            aria-label="Remover produto"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Valor unitário + subtotal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
        <div className="flex items-center gap-2">
          <Label className="text-[11px] text-muted-foreground w-20">Preço unit.:</Label>
          {isIncluso ? (
            <div className="text-xs text-muted-foreground italic">R$ 0,00 (incluso)</div>
          ) : (
            <div className="flex items-center gap-1 flex-1">
              <span className="text-[11px] text-muted-foreground">R$</span>
              <Input
                {...valorInput.inputProps}
                className="h-8 text-xs w-28"
                placeholder="0,00"
              />
            </div>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground sm:text-right">
          Subtotal: <span className="text-foreground font-medium">{isIncluso ? "R$ 0,00" : formatCurrency(subtotal)}</span>
        </div>
      </div>

      {/* Fluxo de produção */}
      <div className="border-t pt-2 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-[11px] text-muted-foreground">Fluxo:</Label>
            <Tabs
              value={fluxo}
              onValueChange={(v) => onFluxoChange(index, v as "padrao" | "custom")}
            >
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="padrao" className="h-6 px-2 text-[11px]">Padrão</TabsTrigger>
                <TabsTrigger value="custom" className="h-6 px-2 text-[11px]">Personalizado</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {fluxo === "custom" && (
            <ProdutoFlowEditPopover
              etapas={etapas}
              onSave={(novasEtapas, nomes) => {
                onEtapasChange(index, novasEtapas);
                onCustomFlowSaved(nomes);
              }}
            />
          )}
        </div>
        <ProdutoFlowTimeline
          etapas={etapas}
          onToggle={(i) => onEtapasChange(index, toggleEtapaAt(etapas, i))}
        />
      </div>
    </div>
  );
}

// Helper reutilizável se algum caller quiser aplicar switch fora do modal.
export const switchProdutoFluxo = switchFluxo;
