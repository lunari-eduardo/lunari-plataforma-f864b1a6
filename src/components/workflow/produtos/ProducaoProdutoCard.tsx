import { ArrowLeft, ArrowRight, Minus, Plus, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  advanceOne,
  retreatOne,
  toggleEtapaAt,
  isEntregue,
  isProdutoStarted,
  type EtapaProducao,
  type ProdutoWorkflowFlow,
} from "@/features/workflow/domain/productFlow";
import { ProducaoTimeline } from "./ProducaoTimeline";
import { ProdutoPriceEditor } from "./ProdutoPriceEditor";
import { ProdutoPrazoPicker } from "./ProdutoPrazoPicker";
import { ProdutoContextMenu } from "./ProdutoContextMenu";
import { ProdutoFlowEditPopover } from "./ProdutoFlowEditPopover";

interface Props {
  ordinal: number;
  produto: ProdutoWorkflowFlow;
  index: number;
  onQuantidadeChange: (index: number, q: number) => void;
  onValorUnitarioChange: (index: number, v: number) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  onEtapasChange: (index: number, etapas: EtapaProducao[]) => void;
  onFluxoChange: (index: number, fluxo: "padrao" | "custom") => void;
  onCustomFlowSaved: (nomes: string[]) => void;
  onPrazoChange: (index: number, iso: string | null) => void;
  formatCurrency: (v: number) => string;
}

export function ProducaoProdutoCard({
  ordinal,
  produto,
  index,
  onQuantidadeChange,
  onValorUnitarioChange,
  onRemove,
  onDuplicate,
  onEtapasChange,
  onFluxoChange,
  onCustomFlowSaved,
  onPrazoChange,
  formatCurrency,
}: Props) {
  const etapas = produto.etapas ?? [];
  const fluxo = produto.fluxo ?? "padrao";
  const isIncluso = produto.tipo === "incluso";
  const subtotal = isIncluso ? 0 : (produto.valorUnitario || 0) * (produto.quantidade || 0);
  const entregue = isEntregue(etapas);
  const doneCount = etapas.filter((e) => e.done).length;
  const started = isProdutoStarted(produto);
  const pending = !started && !entregue;

  const handleAdvance = () => onEtapasChange(index, advanceOne(etapas));
  const handleRetreat = () => onEtapasChange(index, retreatOne(etapas));
  const handleStart = () =>
    // Passar as etapas inalteradas; o allowlist do realtime derivará
    // `started=true` a partir de qualquer marcação. Para start explícito
    // sem marcar etapa, forjamos started via callback dedicado adiante.
    onEtapasChange(index, etapas.map((e) => ({ ...e })));

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm hover:border-border transition-colors">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_180px] gap-4 p-4">
        {/* COL 1 — Identidade + preço */}
        <div className="flex gap-3 min-w-0">
          <div className="shrink-0">
            <div className="h-10 w-10 rounded-md border border-border/60 bg-muted/40 flex items-center justify-center text-[13px] font-semibold tabular-nums text-muted-foreground">
              {String(ordinal).padStart(2, "0")}
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-[14px] font-semibold text-foreground truncate"
                title={produto.nome}
              >
                {produto.nome}
              </span>
            </div>
            {isIncluso && (
              <Badge variant="secondary" className="text-[9px] w-fit">
                Incluso no pacote
              </Badge>
            )}
            {/* Stepper qtd + preço */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center border border-border/60 rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => onQuantidadeChange(index, Math.max(0, (produto.quantidade || 0) - 1))}
                  className="h-7 w-7 flex items-center justify-center hover:bg-muted text-muted-foreground"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="h-7 min-w-[32px] px-1 flex items-center justify-center text-[13px] font-medium tabular-nums bg-background">
                  {produto.quantidade || 0}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantidadeChange(index, (produto.quantidade || 0) + 1)}
                  className="h-7 w-7 flex items-center justify-center hover:bg-muted text-muted-foreground"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <ProdutoPriceEditor
                value={produto.valorUnitario || 0}
                disabled={isIncluso}
                onCommit={(v) => onValorUnitarioChange(index, v)}
                formatCurrency={formatCurrency}
              />
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              Subtotal
              <div className="text-[13px] font-semibold tabular-nums text-foreground">
                {isIncluso ? "R$ 0,00" : formatCurrency(subtotal)}
              </div>
            </div>
          </div>
        </div>

        {/* COL 2 — Timeline + botões voltar/próxima */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
            Fluxo de produção
          </div>
          <ProducaoTimeline
            etapas={etapas}
            onToggle={(i) => onEtapasChange(index, toggleEtapaAt(etapas, i))}
          />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetreat}
              disabled={doneCount === 0}
              className="h-9 text-[12px]"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Voltar etapa
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdvance}
              disabled={entregue}
              className={cn(
                "h-9 text-[12px] border-primary/30 text-primary hover:bg-primary/5 hover:text-primary",
                "hover:border-primary/50",
              )}
            >
              Próxima etapa
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* COL 3 — Fluxo + Prazo + Menu */}
        <div className="flex flex-col gap-3 min-w-0 lg:border-l lg:border-border/40 lg:pl-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80 mb-1">
                Fluxo
              </div>
              <Select
                value={fluxo}
                onValueChange={(v) => onFluxoChange(index, v as "padrao" | "custom")}
              >
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrao">Padrão</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pt-4">
              <ProdutoContextMenu
                showEditCustom={false}
                onDuplicate={() => onDuplicate(index)}
                onEditCustom={() => {}}
                onRemove={() => onRemove(index)}
              />
            </div>
          </div>

          {fluxo === "custom" && (
            <div className="-mt-1">
              <ProdutoFlowEditPopover
                etapas={etapas}
                onSave={(novasEtapas, nomes) => {
                  onEtapasChange(index, novasEtapas);
                  onCustomFlowSaved(nomes);
                }}
              />
            </div>
          )}

          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80 mb-1">
              Prazo
            </div>
            <ProdutoPrazoPicker
              value={produto.prazoEntrega ?? null}
              onChange={(iso) => onPrazoChange(index, iso)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
