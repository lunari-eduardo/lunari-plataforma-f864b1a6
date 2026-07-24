import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, Plus, Info, X, Loader2, Check, AlertCircle } from "lucide-react";
import { useRealtimeConfiguration } from "@/hooks/useRealtimeConfiguration";
import { ProductSearchInput } from "./produtos/ProductSearchInput";
import { ProducaoProdutoCard } from "./produtos/ProducaoProdutoCard";
import { useWorkflowPreferences } from "@/hooks/useWorkflowPreferences";
import {
  buildEtapasPadrao,
  etapasHash,
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
  /**
   * Chamado a cada autosave (debounced). Pode ser invocado múltiplas vezes
   * durante a vida do modal — sempre com a lista completa de produtos.
   */
  onSave: (produtos: ProdutoWorkflowFlow[]) => void | Promise<void>;
}

const genId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const AUTOSAVE_DELAY_MS = 350;
const SAVED_RESET_MS = 1200;
const RETRY_MS = 1500;

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const normalizeForSave = (list: ProdutoWorkflowFlow[]): ProdutoWorkflowFlow[] =>
  list.map((p) =>
    syncLegacyFlags({
      ...p,
      id: p.id ?? genId(),
      fluxo: p.fluxo ?? "padrao",
      etapas: p.etapas && p.etapas.length > 0 ? p.etapas : buildEtapasPadrao(),
      valorUnitario: p.tipo === "incluso" ? 0 : p.valorUnitario,
    }),
  );

const produtoHash = (p: ProdutoWorkflowFlow): string =>
  `${p.id ?? ""}|${p.quantidade ?? 0}|${p.valorUnitario ?? 0}|${p.fluxo ?? "padrao"}|${etapasHash(p.etapas)}|${p.prazoEntrega ?? ""}|${p.started ? "1" : "0"}`;

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
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());

  const pendingCommitRef = useRef<ProdutoWorkflowFlow[] | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const savedResetTimerRef = useRef<number | null>(null);
  const isFlushingRef = useRef(false);
  const onSaveRef = useRef(onSave);
  const customFlowRef = useRef<string[] | null>(null);
  const saveUltimoFluxoCustomRef = useRef<((n: string[]) => Promise<void>) | null>(null);

  const { produtos: produtosConfig } = useRealtimeConfiguration();
  const { prefs, saveUltimoFluxoCustom } = useWorkflowPreferences();

  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  useEffect(() => { customFlowRef.current = customFlowToPersist; }, [customFlowToPersist]);
  useEffect(() => { saveUltimoFluxoCustomRef.current = saveUltimoFluxoCustom; }, [saveUltimoFluxoCustom]);

  const clearCommitTimer = () => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  };
  const clearSavedResetTimer = () => {
    if (savedResetTimerRef.current !== null) {
      window.clearTimeout(savedResetTimerRef.current);
      savedResetTimerRef.current = null;
    }
  };

  const flushCommit = useCallback(async () => {
    clearCommitTimer();
    const pending = pendingCommitRef.current;
    if (!pending || isFlushingRef.current) return;

    const payload = normalizeForSave(pending);
    const sentHashes = new Map(payload.map((p) => [p.id ?? "", produtoHash(p)]));
    pendingCommitRef.current = null;
    isFlushingRef.current = true;
    setSaveState("saving");

    try {
      await onSaveRef.current(payload);

      // Limpa apenas os ids cujo hash local ainda corresponde ao enviado.
      setLocalProdutos((prev) => {
        const dirty = dirtyIdsRef.current;
        for (const p of prev) {
          const id = p.id ?? "";
          if (id && dirty.has(id)) {
            const sent = sentHashes.get(id);
            if (sent && sent === produtoHash(p)) dirty.delete(id);
          }
        }
        return prev;
      });

      const flow = customFlowRef.current;
      if (flow && flow.length > 0) {
        saveUltimoFluxoCustomRef.current?.(flow).catch(() => {});
        setCustomFlowToPersist(null);
      }

      setSaveState(pendingCommitRef.current ? "dirty" : "saved");
      clearSavedResetTimer();
      savedResetTimerRef.current = window.setTimeout(() => {
        if (!pendingCommitRef.current) setSaveState("idle");
      }, SAVED_RESET_MS);
    } catch (err) {
      console.error("[GerenciarProdutosModal] autosave falhou:", err);
      pendingCommitRef.current = pending; // preserva payload para retry
      setSaveState("error");
      clearCommitTimer();
      commitTimerRef.current = window.setTimeout(() => { flushCommit(); }, RETRY_MS);
    } finally {
      isFlushingRef.current = false;
    }
  }, []);

  const scheduleAutosave = useCallback(
    (next: ProdutoWorkflowFlow[], opts?: { immediate?: boolean }) => {
      pendingCommitRef.current = next;
      setSaveState((s) => (s === "saving" ? s : "dirty"));
      clearCommitTimer();
      if (opts?.immediate) {
        void flushCommit();
      } else {
        commitTimerRef.current = window.setTimeout(() => { void flushCommit(); }, AUTOSAVE_DELAY_MS);
      }
    },
    [flushCommit],
  );

  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setResetSignal(true);
      requestAnimationFrame(() => setResetSignal(false));
      dirtyIdsRef.current = new Set();
      deletedIdsRef.current = new Set();
      setAddOpen(false);
      setSaveState("idle");
    }
    wasOpen.current = open;
  }, [open]);

  // Flush pendente ao desmontar (fechar modal).
  useEffect(() => {
    return () => {
      clearCommitTimer();
      clearSavedResetTimer();
      if (pendingCommitRef.current) void flushCommit();
    };
  }, [flushCommit]);

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

  const mutate = (
    updater: (prev: ProdutoWorkflowFlow[]) => ProdutoWorkflowFlow[],
    opts?: { immediate?: boolean },
  ) => {
    setLocalProdutos((prev) => {
      const next = updater(prev);
      scheduleAutosave(next, opts);
      return next;
    });
  };

  const patchProduto = (index: number, patch: Partial<ProdutoWorkflowFlow>) =>
    mutate((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (p.id) dirtyIdsRef.current.add(p.id);
        return { ...p, ...patch };
      }),
    );

  const handleQuantidadeChange = (index: number, novaQuantidade: number) =>
    patchProduto(index, { quantidade: Math.max(0, novaQuantidade) });

  const handleValorUnitarioChange = (index: number, novoValor: number) =>
    mutate((prev) =>
      prev.map((p, i) => {
        if (i !== index || p.tipo !== "manual") return p;
        if (p.id) dirtyIdsRef.current.add(p.id);
        return { ...p, valorUnitario: Math.max(0, novoValor) };
      }),
    );

  const handleRemoverProduto = (index: number) =>
    mutate(
      (prev) => {
        const p = prev[index];
        if (p?.id) dirtyIdsRef.current.add(p.id);
        return prev.filter((_, i) => i !== index);
      },
      { immediate: true },
    );

  const handleDuplicar = (index: number) =>
    mutate(
      (prev) => {
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
      },
      { immediate: true },
    );

  const handleEtapasChange = (index: number, etapas: EtapaProducao[]) =>
    patchProduto(index, { etapas });

  const handleFluxoChange = (index: number, fluxo: "padrao" | "custom") =>
    mutate((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (p.id) dirtyIdsRef.current.add(p.id);
        return switchFluxo(p, fluxo, prefs.ultimoFluxoCustom);
      }),
    );

  const handleCustomFlowSaved = (nomes: string[]) => setCustomFlowToPersist(nomes);

  const handlePrazoChange = (index: number, iso: string | null) =>
    patchProduto(index, { prazoEntrega: iso ?? undefined });

  const handleStartedChange = (index: number, started: boolean) =>
    mutate(
      (prev) =>
        prev.map((p, i) => {
          if (i !== index) return p;
          if (p.id) dirtyIdsRef.current.add(p.id);
          if (started) {
            return { ...p, started: true, startedAt: p.startedAt ?? new Date().toISOString() };
          }
          return { ...p, started: false, startedAt: undefined };
        }),
      { immediate: true },
    );

  const handleSelectProduct = (product: ProductOption) => {
    const productData = productOptions.find((p) => p.nome === product.nome);
    if (!productData) return;
    const produtoExistente = localProdutos.find((p) => p.nome === product.nome);
    if (produtoExistente) {
      mutate(
        (prev) =>
          prev.map((p) => {
            if (p.nome !== product.nome) return p;
            if (p.id) dirtyIdsRef.current.add(p.id);
            return { ...p, quantidade: (p.quantidade || 0) + 1 };
          }),
        { immediate: true },
      );
      setAddOpen(false);
      return;
    }
    const valorString = productData.valor || "R$ 0,00";
    const valorUnitario =
      parseFloat(valorString.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    const newId = genId();
    dirtyIdsRef.current.add(newId);
    mutate(
      (prev) => [
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
      ],
      { immediate: true },
    );
    setAddOpen(false);
  };

  const totalProdutos = localProdutos.length;

  const renderSaveChip = () => {
    if (saveState === "saving")
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
        </span>
      );
    if (saveState === "saved")
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600">
          <Check className="h-3 w-3" /> Salvo
        </span>
      );
    if (saveState === "dirty")
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
          <Loader2 className="h-3 w-3 animate-spin opacity-60" /> Alterações pendentes…
        </span>
      );
    if (saveState === "error")
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" /> Erro ao salvar — tentando novamente
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
        <Check className="h-3 w-3" /> Tudo salvo
      </span>
    );
  };

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
                onStartedChange={handleStartedChange}
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

        {/* Rodapé (autosave chip) */}
        <div className="px-6 py-3 border-t border-border/40 bg-muted/10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Produtos inclusos no pacote não geram valor adicional, mas são acompanhados normalmente.
          </div>
          {renderSaveChip()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
