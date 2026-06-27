import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Package } from "lucide-react";
import { useRealtimeConfiguration } from "@/hooks/useRealtimeConfiguration";
import { ProdutoRow, ProdutoWorkflow } from "./produtos/ProdutoRow";
import { ProductSearchInput } from "./produtos/ProductSearchInput";
import { ProdutosFinancialSummary } from "./produtos/ProdutosFinancialSummary";

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
  produtos: ProdutoWorkflow[];
  productOptions: ProductOption[];
  onSave: (produtos: ProdutoWorkflow[]) => void;
}

export function GerenciarProdutosModal({
  open,
  onOpenChange,
  clienteName,
  produtos,
  productOptions,
  onSave,
}: GerenciarProdutosModalProps) {
  const [localProdutos, setLocalProdutos] = useState<ProdutoWorkflow[]>([]);
  const [resetSignal, setResetSignal] = useState(false);

  const { produtos: produtosConfig } = useRealtimeConfiguration();

  const isInitialized = useRef(false);
  const wasOpen = useRef(false);

  // Sinal de reset para o ProductSearchInput a cada abertura
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
        return {
          ...produto,
          nome: nomeProduto,
          valorUnitario: produto.tipo === "incluso" ? 0 : produto.valorUnitario,
          produzido: produto.produzido ?? false,
          entregue: produto.entregue ?? false,
        };
      });
      setLocalProdutos(produtosCorrigidos);
      isInitialized.current = true;
    }
    if (!open) isInitialized.current = false;
  }, [open, produtos, produtosConfig, productOptions]);

  const totais = useMemo(() => {
    const manuais = localProdutos.filter((p) => p.tipo === "manual");
    const inclusos = localProdutos.filter((p) => p.tipo === "incluso");
    const totalManuais = manuais.reduce((t, p) => t + p.valorUnitario * p.quantidade, 0);
    const totalInclusos = inclusos.reduce((t, p) => t + p.valorUnitario * p.quantidade, 0);
    return { manuais: totalManuais, inclusos: totalInclusos, geral: totalManuais + totalInclusos };
  }, [localProdutos]);

  const formatCurrency = (value: number | undefined | null) =>
    `R$ ${(Number(value) || 0).toFixed(2).replace(".", ",")}`;

  const handleQuantidadeChange = (index: number, novaQuantidade: number) => {
    setLocalProdutos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, quantidade: Math.max(0, novaQuantidade) } : p)),
    );
  };

  const handleRemoverProduto = (index: number) => {
    setLocalProdutos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetFlag = (index: number, key: "produzido" | "entregue", value: boolean) => {
    setLocalProdutos((prev) => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)));
  };

  const handleSelectProduct = (product: ProductOption) => {
    const productData = productOptions.find((p) => p.nome === product.nome);
    if (!productData) return;
    const produtoExistente = localProdutos.find((p) => p.nome === product.nome);
    if (produtoExistente) {
      setLocalProdutos((prev) =>
        prev.map((p) => (p.nome === product.nome ? { ...p, quantidade: p.quantidade + 1 } : p)),
      );
    } else {
      const valorString = productData.valor || "R$ 0,00";
      const valorUnitario =
        parseFloat(valorString.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
      setLocalProdutos((prev) => [
        ...prev,
        {
          nome: product.nome,
          quantidade: 1,
          valorUnitario,
          tipo: "manual",
          produzido: false,
          entregue: false,
        },
      ]);
    }
  };

  const handleSave = () => {
    const produtosParaSalvar = localProdutos.map((p) => ({
      ...p,
      produzido: !!p.produzido,
      entregue: !!p.entregue,
    }));
    onSave(produtosParaSalvar);
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
            <Package className="h-5 w-5 text-blue-600" />
            Gerenciar Produtos para: {clienteName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Adicione, remova ou edite os produtos associados a este projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-[8px] scrollbar-elegant">
          {localProdutos.length > 0 ? (
            <div className="space-y-3 py-0">
              <Label className="text-sm font-normal">Produtos Associados</Label>
              <div className="space-y-2">
                {localProdutos.map((produto, index) => (
                  <ProdutoRow
                    key={index}
                    produto={produto}
                    index={index}
                    onQuantidadeChange={handleQuantidadeChange}
                    onRemove={handleRemoverProduto}
                    onSetFlag={handleSetFlag}
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
