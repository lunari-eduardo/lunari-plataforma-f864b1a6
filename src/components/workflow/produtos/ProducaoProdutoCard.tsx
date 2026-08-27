import { useState, useEffect } from "react";
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
  /** v2: transição pending↔in_progress explícita. */
  onStartedChange: (index: number, started: boolean) => void;
  formatCurrency: (v: number) => string;
}

export function ProducaoProdutoCard({
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
  onStartedChange,
  formatCurrency,
}: Props) {
  const [qtdStr, setQtdStr] = useState<string>(String(produto.quantidade || 1));

  useEffect(() => {
    setQtdStr(String(produto.quantidade || 1));
  }, [produto.quantidade]);

  const handleQtdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQtdStr(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      onQuantidadeChange(index, num);
    }
  };

  const handleQtdBlur = () => {
    const num = parseInt(qtdStr, 10);
    if (isNaN(num) || num < 1) {
      setQtdStr("1");
      onQuantidadeChange(index, 1);
    } else {
      setQtdStr(String(num));
      onQuantidadeChange(index, num);
    }
  };

  const etapas = produto.etapas ?? [];
  const fluxo = produto.fluxo ?? "padrao";
  const isIncluso = produto.tipo === "incluso";
  const subtotal = isIncluso ? 0 : (produto.valorUnitario || 0) * (produto.quantidade || 0);
  const entregue = isEntregue(etapas);
  const doneCount = etapas.filter((e) => e.done).length;
  const started = isProdutoStarted(produto);
  const pending = !started && !entregue;

  const handleAdvance = () => {
    if (!started) onStartedChange(index, true);
    onEtapasChange(index, advanceOne(etapas));
  };
  const handleRetreat = () => onEtapasChange(index, retreatOne(etapas));
  const handleStart = () => onStartedChange(index, true);
  const handleReopen = () => {
    onStartedChange(index, false);
    onEtapasChange(index, etapas.map((e) => ({ ...e, done: false })));
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm hover:border-border transition-colors">
      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr_180px] gap-4 p-4">
        {/* COL 1 — Identidade + quantidade + preço */}
        <div className="flex flex-col gap-2.5 min-w-0">
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

          {/* Stepper de quantidade com digitação direta */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">Qtd:</span>
            <div className="inline-flex items-center border border-border/60 rounded-md overflow-hidden bg-background">
              <button
                type="button"
                onClick={() => {
                  const cur = produto.quantidade || 1;
                  const next = Math.max(1, cur - 1);
                  onQuantidadeChange(index, next);
                }}
                className="h-7 w-7 flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0"
                aria-label="Diminuir quantidade"
              >
                <Minus className="h-3 w-3" />
              </button>
              <input
                type="number"
                min="1"
                value={qtdStr}
                onChange={handleQtdChange}
                onBlur={handleQtdBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="h-7 w-12 text-center text-[13px] font-medium tabular-nums bg-transparent border-x border-border/60 focus:outline-none focus:bg-muted/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Quantidade do produto"
              />
              <button
                type="button"
                onClick={() => {
                  const cur = produto.quantidade || 0;
                  onQuantidadeChange(index, cur + 1);
                }}
                className="h-7 w-7 flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0"
                aria-label="Aumentar quantidade"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Preço unitário e subtotal alinhados abaixo */}
          <div className="pt-2 border-t border-border/40 space-y-1.5 mt-0.5">
            <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
              <span>Unitário:</span>
              <ProdutoPriceEditor
                value={produto.valorUnitario || 0}
                disabled={isIncluso}
                onCommit={(v) => onValorUnitarioChange(index, v)}
                formatCurrency={formatCurrency}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="text-[13px] font-semibold tabular-nums text-foreground">
                {isIncluso ? "R$ 0,00" : formatCurrency(subtotal)}
              </span>
            </div>
          </div>
        </div>

        {/* COL 2 — Timeline + botões voltar/próxima */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
              Fluxo de produção
            </div>
            {pending && (
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">
                A produzir
              </span>
            )}
            {entregue && (
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
                Entregue
              </span>
            )}
          </div>
          <ProducaoTimeline
            etapas={etapas}
            started={started}
            onToggle={(i) => {
              if (!started) onStartedChange(index, true);
              onEtapasChange(index, toggleEtapaAt(etapas, i));
            }}
          />
          {pending ? (
            <div className="pt-1">
              <Button
                type="button"
                onClick={handleStart}
                className="w-full h-9 text-[12px] gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                Iniciar produção
              </Button>
            </div>
          ) : entregue ? (
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReopen}
                className="w-full h-9 text-[12px] gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir produção
              </Button>
            </div>
          ) : (
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
          )}
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
