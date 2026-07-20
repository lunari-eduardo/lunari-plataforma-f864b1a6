import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Package } from "lucide-react";
import { useRealtimeConfiguration } from "@/hooks/useRealtimeConfiguration";
import { ProdutoRow } from "./produtos/ProdutoRow";
import { ProductSearchInput } from "./produtos/ProductSearchInput";
import { ProdutosFinancialSummary } from "./produtos/ProdutosFinancialSummary";
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
  clienteName,
  produtos,
  productOptions,
  onSave,
}: GerenciarProdutosModalProps) {
  const [localProdutos, setLocalProdutos] = useState<ProdutoWorkflowFlow[]>([]);
  const [resetSignal, setResetSignal] = useState(false);
  const [customFlowToPersist, setCustomFlowToPersist] = useState<string[] | null>(null);

  const { produtos: produtosConfig } = useRealtimeConfiguration();
  const { prefs, saveUltimoFluxoCustom } = useWorkflowPreferences();

  const isInitialized = useRef(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setResetSignal(true);
      requestAnimationFrame(() => setResetSignal(false));
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (open && !isInitialized.current) {
      const produtosCorrigidos = produtos.map((produto) => {
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
      setLocalProdutos(produtosCorrigidos);
      setCustomFlowToPersist(null);
      isInitialized.current = true;
    }
    if (!open) isInitialized.current = false;
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

  const patchProduto = (index: number, patch: Partial<ProdutoWorkflowFlow>) =>
    setLocalProdutos((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const handleQuantidadeChange = (index: number, novaQuantidade: number) =>
    patchProduto(index, { quantidade: Math.max(0, novaQuantidade) });

  const handleValorUnitarioChange = (index: number, novoValor: number) => {
    setLocalProdutos((prev) =>
      prev.map((p, i) =>
        i === index && p.tipo === "manual" ? { ...p, valorUnitario: Math.max(0, novoValor) } : p,
      ),
    );
  };

  const handleRemoverProduto = (index: number) =>
    setLocalProdutos((prev) => prev.filter((_, i) => i !== index));

  const handleEtapasChange = (index: number, etapas: EtapaProducao[]) =>
    patchProduto(index, { etapas });

  const handleFluxoChange = (index: number, fluxo: "padrao" | "custom") =>
    setLocalProdutos((prev) =>
      prev.map((p, i) => (i === index ? switchFluxo(p, fluxo, prefs.ultimoFluxoCustom) : p)),
    );

  const handleCustomFlowSaved = (nomes: string[]) => {
    setCustomFlowToPersist(nomes);
  };

  const handleSelectProduct = (product: ProductOption) => {
    const productData = productOptions.find((p) => p.nome === product.nome);
    if (!productData) return;
    const produtoExistente = localProdutos.find((p) => p.nome === product.nome);
    if (produtoExistente) {
      setLocalProdutos((prev) =>
        prev.map((p) => (p.nome === product.nome ? { ...p, quantidade: (p.quantidade || 0) + 1 } : p)),
      );
      return;
    }
    const valorString = productData.valor || "R$ 0,00";
    const valorUnitario =
      parseFloat(valorString.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    setLocalProdutos((prev) => [
      ...prev,
      {
        id: genId(),
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
      // Fire-and-forget — não bloqueia o fechamento do modal.
      saveUltimoFluxoCustom(customFlowToPersist).catch(() => {});
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[92vw] sm:max-w-2xl max-h-[90vh] flex flex-col py-[17px] px-3 sm:px-6 text-xs sm:text-sm"
        onPointerDownOutside={(e) => {
          const target = e.target as Element;
          if (
            target.closest("[data-radix-popover-content]") ||
            target.closest("[cmdk-item]") ||
            target.closest("[data-product-dropdown]")
          ) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Package className="h-5 w-5 text-primary" />
            Gerenciar Produtos para: {clienteName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Ajuste quantidade, preço unitário e etapas de produção de cada produto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-[8px] scrollbar-elegant">
          {localProdutos.length > 0 ? (
            <div className="space-y-3 py-0">
              <Label className="text-sm font-normal">Produtos Associados</Label>
              <div className="space-y-2">
                {localProdutos.map((produto, index) => (
                  <ProdutoRow
                    key={produto.id ?? index}
                    produto={produto}
                    index={index}
                    ultimoCustomNomes={prefs.ultimoFluxoCustom}
                    onQuantidadeChange={handleQuantidadeChange}
                    onValorUnitarioChange={handleValorUnitarioChange}
                    onRemove={handleRemoverProduto}
                    onEtapasChange={handleEtapasChange}
                    onFluxoChange={handleFluxoChange}
                    onCustomFlowSaved={handleCustomFlowSaved}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum produto associado a este projeto.</p>
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-normal">Adicionar Novo Produto</Label>
            <ProductSearchInput
              productOptions={productOptions}
              onSelect={handleSelectProduct}
              resetSignal={resetSignal}
            />
          </div>
        </div>

        {localProdutos.length > 0 && (
          <ProdutosFinancialSummary totais={totais} formatCurrency={formatCurrency} />
        )}

        <DialogFooter className="py-0 my-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 text-xs">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="h-9 text-xs">
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
