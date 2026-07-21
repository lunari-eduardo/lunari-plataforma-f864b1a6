import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, Plus, Info, X } from "lucide-react";
import { useRealtimeConfiguration } from "@/hooks/useRealtimeConfiguration";
import { ProductSearchInput } from "./produtos/ProductSearchInput";
import { ProducaoProdutoCard } from "./produtos/ProducaoProdutoCard";
import { useWorkflowPreferences } from "@/hooks/useWorkflowPreferences";
import {
  buildEtapasPadrao,
  hydrateProduto,
  switchFluxo,
  syncLegacyFlags,
  type EtapaProducao,
  type ProdutoWorkflowFlow,
} from "@/features/workflow/domain/productFlow";

interface ProductOption {
  id: string;
  nome: string;
  valor: string;
}

interface GerenciarProdutosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  clienteName: string;
  produtos: ProdutoWorkflowFlow[];
  productOptions: ProductOption[];
  onSave: (produtos: ProdutoWorkflowFlow[]) => void;
}

const genId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function GerenciarProdutosModal({
  open,
  onOpenChange,
  produtos,
  productOptions,
  onSave,
}: GerenciarProdutosModalProps) {
  const [localProdutos, setLocalProdutos] = useState<ProdutoWorkflowFlow[]>([]);
  const [resetSignal, setResetSignal] = useState(false);
  const [customFlowToPersist, setCustomFlowToPersist] = useState<string[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const dirtyIdsRef = useRef<Set<string>>(new Set());

  const { produtos: produtosConfig } = useRealtimeConfiguration();
  const { prefs, saveUltimoFluxoCustom } = useWorkflowPreferences();

  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setResetSignal(true);
      requestAnimationFrame(() => setResetSignal(false));
      dirtyIdsRef.current = new Set();
      setAddOpen(false);
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const hydratedProps = produtos.map((produto) => {
      let nomeProduto = produto.nome;
      if (!nomeProduto || nomeProduto.startsWith("Produto ID:")) {
        const produtoEncontrado =
          produtosConfig.find(
            (p) => p.nome === produto.nome || p.id === produto.nome || produto.nome?.includes(p.id),
          ) ||
          productOptions.find(
            (p) => p.nome === produto.nome || p.id === produto.nome || produto.nome?.includes(p.id),
          );
        if (produtoEncontrado) nomeProduto = produtoEncontrado.nome;
      }
      const hydrated = hydrateProduto({
        ...produto,
        nome: nomeProduto,
        valorUnitario: produto.tipo === "incluso" ? 0 : produto.valorUnitario,
      });
      return { ...hydrated, id: hydrated.id ?? genId() };
    });

    setLocalProdutos((prev) => {
      if (prev.length === 0) return hydratedProps;
      const dirty = dirtyIdsRef.current;
      const prevById = new Map(prev.map((p) => [p.id ?? "", p]));
      const merged = hydratedProps.map((incoming) => {
        const id = incoming.id ?? "";
        if (id && dirty.has(id)) {
          const local = prevById.get(id);
          if (local) return local;
        }
        return incoming;
      });
      const incomingIds = new Set(hydratedProps.map((p) => p.id));
      for (const p of prev) {
        if (!incomingIds.has(p.id) && p.id && dirty.has(p.id)) merged.push(p);
      }
      return merged;
    });
  }, [open, produtos, produtosConfig, productOptions]);

  const totais = useMemo(() => {
    const manuais = localProdutos.filter((p) => p.tipo === "manual");
    const inclusos = localProdutos.filter((p) => p.tipo === "incluso");
    const totalManuais = manuais.reduce((t, p) => t + (p.valorUnitario || 0) * (p.quantidade || 0), 0);
    const totalInclusos = inclusos.reduce((t, p) => t + (p.valorUnitario || 0) * (p.quantidade || 0), 0);
    return { manuais: totalManuais, inclusos: totalInclusos, geral: totalManuais + totalInclusos };
  }, [localProdutos]);

  const formatCurrency = (value: number | undefined | null) =>
    `R$ ${(Number(value) || 0).toFixed(2).replace(".", ",")}`;

  const patchProduto = (index: number, patch: Partial<ProdutoWorkflowFlow>) => {
    setLocalProdutos((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (p.id) dirtyIdsRef.current.add(p.id);
        return { ...p, ...patch };
      }),
    );
  };

  const handleQuantidadeChange = (index: number, novaQuantidade: number) =>
    patchProduto(index, { quantidade: Math.max(0, novaQuantidade) });

  const handleValorUnitarioChange = (index: number, novoValor: number) => {
    setLocalProdutos((prev) =>
      prev.map((p, i) => {
        if (i !== index || p.tipo !== "manual") return p;
        if (p.id) dirtyIdsRef.current.add(p.id);
        return { ...p, valorUnitario: Math.max(0, novoValor) };
      }),
    );
  };

  const handleRemoverProduto = (index: number) => {
    setLocalProdutos((prev) => {
      const p = prev[index];
      if (p?.id) dirtyIdsRef.current.add(p.id);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDuplicar = (index: number) => {
    setLocalProdutos((prev) => {
      const src = prev[index];
      if (!src) return prev;
      const newId = genId();
      dirtyIdsRef.current.add(newId);
      const copy: ProdutoWorkflowFlow = {
        ...src,
        id: newId,
        etapas: (src.etapas ?? buildEtapasPadrao()).map((e) => ({ ...e, done: false })),
        produzido: false,
        entregue: false,
        prazoEntrega: undefined,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const handleEtapasChange = (index: number, etapas: EtapaProducao[]) =>
    patchProduto(index, { etapas });

  const handleFluxoChange = (index: number, fluxo: "padrao" | "custom") =>
    setLocalProdutos((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (p.id) dirtyIdsRef.current.add(p.id);
        return switchFluxo(p, fluxo, prefs.ultimoFluxoCustom);
      }),
    );

  const handleCustomFlowSaved = (nomes: string[]) => setCustomFlowToPersist(nomes);

  const handlePrazoChange = (index: number, iso: string | null) =>
    patchProduto(index, { prazoEntrega: iso ?? undefined });

  const handleSelectProduct = (product: ProductOption) => {
    const productData = productOptions.find((p) => p.nome === product.nome);
    if (!productData) return;
    const produtoExistente = localProdutos.find((p) => p.nome === product.nome);
    if (produtoExistente) {
      setLocalProdutos((prev) =>
        prev.map((p) => {
          if (p.nome !== product.nome) return p;
          if (p.id) dirtyIdsRef.current.add(p.id);
          return { ...p, quantidade: (p.quantidade || 0) + 1 };
        }),
      );
      setAddOpen(false);
      return;
    }
    const valorString = productData.valor || "R$ 0,00";
    const valorUnitario =
      parseFloat(valorString.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    const newId = genId();
    dirtyIdsRef.current.add(newId);
    setLocalProdutos((prev) => [
      ...prev,
      {
        id: newId,
        produtoId: productData.id,
        nome: product.nome,
        quantidade: 1,
        valorUnitario,
        tipo: "manual",
        fluxo: "padrao",
        etapas: buildEtapasPadrao(),
        produzido: false,
        entregue: false,
      },
    ]);
    setAddOpen(false);
  };

  const handleSave = async () => {
    const produtosParaSalvar = localProdutos.map((p) =>
      syncLegacyFlags({
        ...p,
        id: p.id ?? genId(),
        fluxo: p.fluxo ?? "padrao",
        etapas: p.etapas && p.etapas.length > 0 ? p.etapas : buildEtapasPadrao(),
      }),
    );
    onSave(produtosParaSalvar);
    if (customFlowToPersist && customFlowToPersist.length > 0) {
      saveUltimoFluxoCustom(customFlowToPersist).catch(() => {});
    }
    dirtyIdsRef.current = new Set();
    onOpenChange(false);
  };

  const totalProdutos = localProdutos.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[92vw] sm:max-w-[1080px] max-h-[92vh] flex flex-col p-0 gap-0"
        onPointerDownOutside={(e) => {
          const target = e.target as Element;
          if (
            target.closest("[data-radix-popover-content]") ||
            target.closest("[data-radix-dropdown-menu-content]") ||
            target.closest("[cmdk-item]") ||
            target.closest("[data-product-dropdown]")
          ) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2.5 text-[16px]">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            Produção da sessão
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[12px] ml-[42px]">
            Acompanhe o andamento dos produtos e o que ainda precisa ser feito.
          </DialogDescription>
        </DialogHeader>

        {/* Header executivo */}
        <div className="px-6 pt-4 pb-3">
          <div className="rounded-xl border border-border/60 bg-muted/20 px-5 py-3.5 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div className="leading-tight">
                <div className="text-[18px] font-semibold tabular-nums text-foreground">
                  {totalProdutos}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {totalProdutos === 1 ? "produto" : "produtos"}
                </div>
              </div>
            </div>
            <div className="h-8 w-px bg-border/40 hidden sm:block" />
            <div className="leading-tight">
              <div className="text-[18px] font-semibold tabular-nums text-foreground">
                {formatCurrency(totais.geral)}
              </div>
              <div className="text-[11px] text-muted-foreground">valor dos produtos</div>
            </div>
            <div className="flex-1" />
            <Button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="h-9 gap-2 text-[13px]"
              variant={addOpen ? "outline" : "default"}
            >
              {addOpen ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Fechar
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar produto
                </>
              )}
            </Button>
          </div>

          {addOpen && (
            <div className="mt-3 rounded-lg border border-border/60 bg-background p-3">
              <div className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wide font-medium">
                Buscar produto
              </div>
              <ProductSearchInput
                productOptions={productOptions}
                onSelect={handleSelectProduct}
                resetSignal={resetSignal}
              />
            </div>
          )}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3 scrollbar-elegant min-h-0">
          {localProdutos.length > 0 ? (
            localProdutos.map((produto, index) => (
              <ProducaoProdutoCard
                key={produto.id ?? index}
                ordinal={index + 1}
                produto={produto}
                index={index}
                onQuantidadeChange={handleQuantidadeChange}
                onValorUnitarioChange={handleValorUnitarioChange}
                onRemove={handleRemoverProduto}
                onDuplicate={handleDuplicar}
                onEtapasChange={handleEtapasChange}
                onFluxoChange={handleFluxoChange}
                onCustomFlowSaved={handleCustomFlowSaved}
                onPrazoChange={handlePrazoChange}
                formatCurrency={formatCurrency}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-[13px]">Nenhum produto associado a esta sessão.</p>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="text-[12px] text-primary hover:underline mt-2"
              >
                + Adicionar o primeiro produto
              </button>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 border-t border-border/40 bg-muted/10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Produtos inclusos no pacote não geram valor adicional, mas são acompanhados normalmente.
          </div>
          <DialogFooter className="p-0 gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 text-[13px]">
              Fechar
            </Button>
            <Button onClick={handleSave} className="h-9 text-[13px]">
              Salvar alterações
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
