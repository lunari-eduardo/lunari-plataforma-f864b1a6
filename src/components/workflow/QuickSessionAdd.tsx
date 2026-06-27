import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProductComboboxItem } from "@/components/agenda/ProductSearchCombobox";
import { useOrcamentoData } from "@/hooks/useOrcamentoData";
import { toast } from "sonner";

import { QuickSessionBasicFields } from "./quick/QuickSessionBasicFields";
import { QuickSessionValuesFields } from "./quick/QuickSessionValuesFields";
import { QuickSessionProductsList, ManualProduct } from "./quick/QuickSessionProductsList";
import { QuickSessionTotalsAndActions } from "./quick/QuickSessionTotalsAndActions";

const getMonthName = (month: number) => {
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return monthNames[month - 1];
};

export interface QuickSessionData {
  clienteId: string;
  dataSessao: string;
  horaSessao: string;
  categoria: string;
  pacote?: string;
  descricao?: string;
  status?: string;
  valorBasePacote: number;
  qtdFotosExtra?: number;
  valorFotoExtra?: number;
  valorAdicional?: number;
  desconto?: number;
  valorPago?: number;
  produtosIncluidos?: { nome: string; quantidade: number; valorUnitario: number }[];
  detalhes?: string;
  observacoes?: string;
}

interface QuickSessionAddProps {
  onSubmit: (data: QuickSessionData) => Promise<void>;
  currentMonth: { month: number; year: number };
}

export function QuickSessionAdd({ onSubmit, currentMonth }: QuickSessionAddProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { categorias } = useOrcamentoData();

  const [clienteId, setClienteId] = useState("");
  const [diaSessao, setDiaSessao] = useState("");

  const dataSessaoCompleta = useMemo(() => {
    if (!diaSessao) return "";
    const dia = diaSessao.padStart(2, "0");
    const mes = String(currentMonth.month).padStart(2, "0");
    return `${currentMonth.year}-${mes}-${dia}`;
  }, [diaSessao, currentMonth]);

  const [categoria, setCategoria] = useState("");
  const [pacote, setPacote] = useState("");
  const [valorBasePacote, setValorBasePacote] = useState("0");
  const [qtdFotosExtra, setQtdFotosExtra] = useState("0");
  const [totalFotosExtraManual, setTotalFotosExtraManual] = useState("0");
  const [valorFotoExtraCalculado, setValorFotoExtraCalculado] = useState(0);
  const [desconto, setDesconto] = useState("0");
  const [valorPago, setValorPago] = useState("0");
  const [produtos, setProdutos] = useState<ManualProduct[]>([]);
  const [autoFilledByPackage, setAutoFilledByPackage] = useState(false);

  const [totalProdutos, setTotalProdutos] = useState(0);
  const [totalSessao, setTotalSessao] = useState(0);
  const [restante, setRestante] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const focusNewProductIndexRef = useRef<number | null>(null);

  const categoryOptions = categorias.map((nome, index) => ({
    id: String(index + 1),
    nome,
  }));

  // INVERSÃO: total editável, unitário calculado
  useEffect(() => {
    const qtd = parseFloat(qtdFotosExtra) || 0;
    const totalManual = parseFloat(totalFotosExtraManual) || 0;
    setValorFotoExtraCalculado(qtd > 0 && totalManual > 0 ? totalManual / qtd : 0);
  }, [qtdFotosExtra, totalFotosExtraManual]);

  useEffect(() => {
    const total = produtos.reduce((sum, p) => sum + p.quantidade * p.valorUnitario, 0);
    setTotalProdutos(total);
  }, [produtos]);

  useEffect(() => {
    const valorPacoteNum = parseFloat(valorBasePacote) || 0;
    const totalFotosExtra = parseFloat(totalFotosExtraManual) || 0;
    const desc = parseFloat(desconto) || 0;
    const pago = parseFloat(valorPago) || 0;
    const total = valorPacoteNum + totalFotosExtra + totalProdutos - desc;
    setTotalSessao(Math.max(0, total));
    setRestante(Math.max(0, total - pago));
  }, [valorBasePacote, totalFotosExtraManual, totalProdutos, desconto, valorPago]);

  const focusClienteInput = useCallback(() => {
    setTimeout(() => {
      const input = containerRef.current?.querySelector<HTMLInputElement>(
        "[data-quick-session-cliente] input",
      );
      input?.focus();
    }, 80);
  }, []);

  useEffect(() => {
    if (isOpen) focusClienteInput();
  }, [isOpen, focusClienteInput]);

  useEffect(() => {
    if (focusNewProductIndexRef.current === null) return;
    const idx = focusNewProductIndexRef.current;
    setTimeout(() => {
      const inputs = containerRef.current?.querySelectorAll<HTMLInputElement>(
        "[data-quick-session-product] input",
      );
      inputs?.[idx]?.focus();
      focusNewProductIndexRef.current = null;
    }, 50);
  }, [produtos.length]);

  const isDirty = useMemo(
    () =>
      Boolean(
        clienteId || diaSessao || categoria || pacote || produtos.length > 0 ||
        parseFloat(valorBasePacote) > 0 || parseFloat(qtdFotosExtra) > 0 ||
        parseFloat(totalFotosExtraManual) > 0 || parseFloat(desconto) > 0 ||
        parseFloat(valorPago) > 0,
      ),
    [clienteId, diaSessao, categoria, pacote, produtos.length, valorBasePacote, qtdFotosExtra, totalFotosExtraManual, desconto, valorPago],
  );

  const handleAddProduct = useCallback(() => {
    setProdutos((prev) => {
      const next = [...prev, { nome: "", quantidade: 1, valorUnitario: 0 }];
      focusNewProductIndexRef.current = next.length - 1;
      return next;
    });
  }, []);

  const handleRemoveProduct = (index: number) =>
    setProdutos(produtos.filter((_, i) => i !== index));

  const handleProductSelect = (index: number, product: ProductComboboxItem | null) => {
    if (!product) return;
    setProdutos((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        produtoId: product.id,
        nome: product.nome,
        valorUnitario: product.valorVenda,
        quantidade: next[index].quantidade > 0 ? next[index].quantidade : 1,
      };
      return next;
    });
    setTimeout(() => {
      const qtyInput = containerRef.current?.querySelector<HTMLInputElement>(
        `[data-quick-session-qty="${index}"]`,
      );
      qtyInput?.focus();
      qtyInput?.select();
    }, 50);
  };

  const handleProductQtyChange = (index: number, qty: number) => {
    setProdutos((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantidade: qty };
      return next;
    });
  };

  const handlePackageChange = (packageData: {
    nome: string;
    valorBase: number;
    valorFotoExtra: number;
    categoria: string;
  }) => {
    setPacote(packageData.nome);
    setValorBasePacote(packageData.valorBase.toString());
    if (packageData.categoria) setCategoria(packageData.categoria);
    setAutoFilledByPackage(true);
  };

  const handleClearPackage = () => {
    setPacote("");
    setAutoFilledByPackage(false);
  };

  const validateForm = (): boolean => {
    if (!clienteId) return toast.error("Selecione um cliente"), false;
    const diaNum = parseInt(diaSessao);
    if (!diaSessao || isNaN(diaNum) || diaNum < 1 || diaNum > 31) {
      return toast.error("Informe um dia válido (1-31)"), false;
    }
    const daysInMonth = new Date(currentMonth.year, currentMonth.month, 0).getDate();
    if (diaNum > daysInMonth) {
      return toast.error(`${getMonthName(currentMonth.month)} só tem ${daysInMonth} dias`), false;
    }
    if (!categoria.trim()) return toast.error("Informe a categoria"), false;
    if (parseFloat(valorBasePacote) < 0) return toast.error("Valor do pacote não pode ser negativo"), false;
    for (const produto of produtos) {
      if (!produto.nome.trim()) return toast.error("Selecione um produto em todas as linhas (ou remova as vazias)"), false;
      if (produto.quantidade <= 0) return toast.error("Quantidade do produto deve ser maior que zero"), false;
    }
    return true;
  };

  const handleClear = useCallback(
    (skipConfirm = false) => {
      if (!skipConfirm && isDirty) {
        if (!window.confirm("Limpar todos os campos preenchidos?")) return;
      }
      setClienteId("");
      setDiaSessao("");
      setCategoria("");
      setPacote("");
      setValorBasePacote("0");
      setQtdFotosExtra("0");
      setTotalFotosExtraManual("0");
      setDesconto("0");
      setValorPago("0");
      setProdutos([]);
      setAutoFilledByPackage(false);
    },
    [isDirty],
  );

  const handleClose = useCallback(() => {
    if (isDirty && !window.confirm("Há dados não salvos. Fechar mesmo assim?")) return;
    setIsOpen(false);
  }, [isDirty]);

  const doSubmit = useCallback(
    async (keepOpen: boolean) => {
      if (!validateForm()) return;
      setIsSubmitting(true);
      try {
        const qtd = parseFloat(qtdFotosExtra) || 0;
        const totalFotos = parseFloat(totalFotosExtraManual) || 0;
        const valorUnitarioCalculado = qtd > 0 ? totalFotos / qtd : 0;

        const data: QuickSessionData = {
          clienteId,
          dataSessao: dataSessaoCompleta,
          horaSessao: "00:00",
          categoria,
          pacote: pacote.trim() || undefined,
          status: "concluído",
          valorBasePacote: parseFloat(valorBasePacote) || 0,
          qtdFotosExtra: qtd,
          valorFotoExtra: valorUnitarioCalculado,
          desconto: parseFloat(desconto) || 0,
          valorPago: parseFloat(valorPago) || 0,
          produtosIncluidos:
            produtos.length > 0
              ? produtos.map(({ nome, quantidade, valorUnitario }) => ({ nome, quantidade, valorUnitario }))
              : undefined,
        };

        await onSubmit(data);
        handleClear(true);
        if (keepOpen) focusClienteInput();
        else setIsOpen(false);
      } catch (error) {
        console.error("Erro ao criar sessão:", error);
      } finally {
        setIsSubmitting(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [clienteId, dataSessaoCompleta, categoria, pacote, valorBasePacote, qtdFotosExtra, totalFotosExtraManual, desconto, valorPago, produtos, onSubmit, handleClear, focusClienteInput],
  );

  const handleSubmit = () => doSubmit(false);
  const handleSubmitAndAddAnother = () => doSubmit(true);

  useEffect(() => {
    if (!isOpen) return;
    const node = containerRef.current;
    if (!node) return;

    const handler = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); return; }
      if (isCtrl && e.shiftKey && e.key === "Enter") { e.preventDefault(); handleSubmitAndAddAnother(); return; }
      if (isCtrl && (e.key === "s" || e.key === "S")) { e.preventDefault(); handleSubmit(); return; }
      if (isCtrl && (e.key === "p" || e.key === "P")) { e.preventDefault(); handleAddProduct(); return; }
      if (isCtrl && (e.key === "l" || e.key === "L")) { e.preventDefault(); handleClear(); return; }
      if (e.key === "Escape") {
        const hasOpenDropdown = node.querySelector("[data-radix-popper-content-wrapper]");
        if (hasOpenDropdown) return;
        e.preventDefault();
        handleClose();
      }
    };
    node.addEventListener("keydown", handler);
    return () => node.removeEventListener("keydown", handler);
  }, [isOpen, handleAddProduct, handleClear, handleClose, doSubmit]);

  const formatCurrency = (value: any) =>
    `R$ ${(Number(value) || 0).toFixed(2).replace(".", ",")}`;

  return (
    <div
      ref={containerRef}
      className="mb-4 border border-dashed border-primary/30 rounded-lg bg-primary/5"
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4 hover:bg-primary/10"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="font-medium">Adicionar Sessão Rápida (Dados Históricos)</span>
              <span className="text-xs bg-orange-500/20 text-orange-700 px-2 py-0.5 rounded">
                Modo Temporário
              </span>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <TooltipProvider delayDuration={300}>
            <div className="p-4 space-y-4">
              <QuickSessionBasicFields
                clienteId={clienteId}
                setClienteId={setClienteId}
                diaSessao={diaSessao}
                setDiaSessao={setDiaSessao}
                currentMonth={currentMonth}
                pacote={pacote}
                onPackageChange={handlePackageChange}
                onClearPackage={handleClearPackage}
                categoria={categoria}
                autoFilledByPackage={autoFilledByPackage}
                categoryOptions={categoryOptions}
                onCategoryChange={setCategoria}
              />

              <QuickSessionValuesFields
                valorBasePacote={valorBasePacote}
                setValorBasePacote={setValorBasePacote}
                autoFilledByPackage={autoFilledByPackage}
                qtdFotosExtra={qtdFotosExtra}
                setQtdFotosExtra={setQtdFotosExtra}
                totalFotosExtraManual={totalFotosExtraManual}
                setTotalFotosExtraManual={setTotalFotosExtraManual}
                valorFotoExtraCalculado={valorFotoExtraCalculado}
                desconto={desconto}
                setDesconto={setDesconto}
                valorPago={valorPago}
                setValorPago={setValorPago}
                formatCurrency={formatCurrency}
              />

              <QuickSessionProductsList
                produtos={produtos}
                onSelectProduct={handleProductSelect}
                onQtyChange={handleProductQtyChange}
                onRemove={handleRemoveProduct}
                onAdd={handleAddProduct}
                formatCurrency={formatCurrency}
              />

              <QuickSessionTotalsAndActions
                totalFotosExtraManual={totalFotosExtraManual}
                totalProdutos={totalProdutos}
                totalSessao={totalSessao}
                valorPago={valorPago}
                restante={restante}
                formatCurrency={formatCurrency}
                isSubmitting={isSubmitting}
                onClose={handleClose}
                onClear={() => handleClear()}
                onSubmitAndAdd={handleSubmitAndAddAnother}
                onSubmit={handleSubmit}
              />
            </div>
          </TooltipProvider>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
