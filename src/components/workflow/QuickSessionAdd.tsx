import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ChevronDown, ChevronUp, X, Keyboard } from 'lucide-react';
import ClientSearchCombobox from '@/components/agenda/ClientSearchCombobox';
import ProductSearchCombobox, { ProductComboboxItem } from '@/components/agenda/ProductSearchCombobox';
import { PackageCombobox } from '@/components/workflow/PackageCombobox';
import { CategoryCombobox } from '@/components/workflow/CategoryCombobox';
import { useOrcamentoData } from '@/hooks/useOrcamentoData';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Helper para nome do mês
const getMonthName = (month: number) => {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return monthNames[month - 1];
};

// Handler para auto-selecionar texto ao focar em inputs numéricos
const handleNumberInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  setTimeout(() => e.target.select(), 0);
};

interface ManualProduct {
  produtoId?: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

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

  // Fetch categories from database
  const { categorias } = useOrcamentoData();

  // Form fields
  const [clienteId, setClienteId] = useState('');
  const [diaSessao, setDiaSessao] = useState('');

  // Compor data completa: ano-mes-dia (baseado no mês atual do workflow)
  const dataSessaoCompleta = useMemo(() => {
    if (!diaSessao) return '';
    const dia = diaSessao.padStart(2, '0');
    const mes = String(currentMonth.month).padStart(2, '0');
    return `${currentMonth.year}-${mes}-${dia}`;
  }, [diaSessao, currentMonth]);
  const [categoria, setCategoria] = useState('');
  const [pacote, setPacote] = useState('');
  const [valorBasePacote, setValorBasePacote] = useState('0');
  const [qtdFotosExtra, setQtdFotosExtra] = useState('0');
  const [totalFotosExtraManual, setTotalFotosExtraManual] = useState('0');
  const [valorFotoExtraCalculado, setValorFotoExtraCalculado] = useState(0);
  const [desconto, setDesconto] = useState('0');
  const [valorPago, setValorPago] = useState('0');
  const [produtos, setProdutos] = useState<ManualProduct[]>([]);

  const [autoFilledByPackage, setAutoFilledByPackage] = useState(false);

  const [totalProdutos, setTotalProdutos] = useState(0);
  const [totalSessao, setTotalSessao] = useState(0);
  const [restante, setRestante] = useState(0);

  // Refs para controle de foco
  const containerRef = useRef<HTMLDivElement>(null);
  const clienteRef = useRef<HTMLDivElement>(null);
  const focusNewProductIndexRef = useRef<number | null>(null);

  const categoryOptions = categorias.map((nome, index) => ({
    id: String(index + 1),
    nome
  }));

  // INVERSÃO DE LÓGICA: Total é editável, valor unitário é calculado
  useEffect(() => {
    const qtd = parseFloat(qtdFotosExtra) || 0;
    const totalManual = parseFloat(totalFotosExtraManual) || 0;

    if (qtd > 0 && totalManual > 0) {
      const valorUnit = totalManual / qtd;
      setValorFotoExtraCalculado(valorUnit);
    } else {
      setValorFotoExtraCalculado(0);
    }
  }, [qtdFotosExtra, totalFotosExtraManual]);

  useEffect(() => {
    const total = produtos.reduce((sum, p) => {
      return sum + (p.quantidade * p.valorUnitario);
    }, 0);
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

  // Auto-focus no cliente ao abrir
  const focusClienteInput = useCallback(() => {
    setTimeout(() => {
      const input = containerRef.current?.querySelector<HTMLInputElement>(
        '[data-quick-session-cliente] input'
      );
      input?.focus();
    }, 80);
  }, []);

  useEffect(() => {
    if (isOpen) {
      focusClienteInput();
    }
  }, [isOpen, focusClienteInput]);

  // Foca o combobox do produto recém-adicionado
  useEffect(() => {
    if (focusNewProductIndexRef.current === null) return;
    const idx = focusNewProductIndexRef.current;
    setTimeout(() => {
      const inputs = containerRef.current?.querySelectorAll<HTMLInputElement>(
        '[data-quick-session-product] input'
      );
      const target = inputs?.[idx];
      target?.focus();
      focusNewProductIndexRef.current = null;
    }, 50);
  }, [produtos.length]);

  const isDirty = useMemo(() => {
    return Boolean(
      clienteId ||
      diaSessao ||
      categoria ||
      pacote ||
      produtos.length > 0 ||
      parseFloat(valorBasePacote) > 0 ||
      parseFloat(qtdFotosExtra) > 0 ||
      parseFloat(totalFotosExtraManual) > 0 ||
      parseFloat(desconto) > 0 ||
      parseFloat(valorPago) > 0
    );
  }, [clienteId, diaSessao, categoria, pacote, produtos.length, valorBasePacote, qtdFotosExtra, totalFotosExtraManual, desconto, valorPago]);

  const handleAddProduct = useCallback(() => {
    setProdutos((prev) => {
      const next = [...prev, { nome: '', quantidade: 1, valorUnitario: 0 }];
      focusNewProductIndexRef.current = next.length - 1;
      return next;
    });
  }, []);

  const handleRemoveProduct = (index: number) => {
    setProdutos(produtos.filter((_, i) => i !== index));
  };

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
    // Foca campo de quantidade da linha
    setTimeout(() => {
      const qtyInput = containerRef.current?.querySelector<HTMLInputElement>(
        `[data-quick-session-qty="${index}"]`
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

    if (packageData.categoria) {
      setCategoria(packageData.categoria);
    }

    setAutoFilledByPackage(true);
  };

  const handleClearPackage = () => {
    setPacote('');
    setAutoFilledByPackage(false);
  };

  const handleCategoryChange = (newCategory: string) => {
    setCategoria(newCategory);
  };

  const validateForm = (): boolean => {
    if (!clienteId) {
      toast.error('Selecione um cliente');
      return false;
    }

    const diaNum = parseInt(diaSessao);
    if (!diaSessao || isNaN(diaNum) || diaNum < 1 || diaNum > 31) {
      toast.error('Informe um dia válido (1-31)');
      return false;
    }

    const daysInMonth = new Date(currentMonth.year, currentMonth.month, 0).getDate();
    if (diaNum > daysInMonth) {
      toast.error(`${getMonthName(currentMonth.month)} só tem ${daysInMonth} dias`);
      return false;
    }

    if (!categoria.trim()) {
      toast.error('Informe a categoria');
      return false;
    }
    if (parseFloat(valorBasePacote) < 0) {
      toast.error('Valor do pacote não pode ser negativo');
      return false;
    }

    for (const produto of produtos) {
      if (!produto.nome.trim()) {
        toast.error('Selecione um produto em todas as linhas (ou remova as vazias)');
        return false;
      }
      if (produto.quantidade <= 0) {
        toast.error('Quantidade do produto deve ser maior que zero');
        return false;
      }
    }

    return true;
  };

  const handleClear = useCallback((skipConfirm = false) => {
    if (!skipConfirm && isDirty) {
      const ok = window.confirm('Limpar todos os campos preenchidos?');
      if (!ok) return;
    }
    setClienteId('');
    setDiaSessao('');
    setCategoria('');
    setPacote('');
    setValorBasePacote('0');
    setQtdFotosExtra('0');
    setTotalFotosExtraManual('0');
    setDesconto('0');
    setValorPago('0');
    setProdutos([]);
    setAutoFilledByPackage(false);
  }, [isDirty]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm('Há dados não salvos. Fechar mesmo assim?');
      if (!ok) return;
    }
    setIsOpen(false);
  }, [isDirty]);

  const doSubmit = useCallback(async (keepOpen: boolean) => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const qtd = parseFloat(qtdFotosExtra) || 0;
      const totalFotos = parseFloat(totalFotosExtraManual) || 0;
      const valorUnitarioCalculado = qtd > 0 ? totalFotos / qtd : 0;

      const data: QuickSessionData = {
        clienteId,
        dataSessao: dataSessaoCompleta,
        horaSessao: '00:00',
        categoria,
        pacote: pacote.trim() || undefined,
        status: 'concluído',
        valorBasePacote: parseFloat(valorBasePacote) || 0,
        qtdFotosExtra: qtd,
        valorFotoExtra: valorUnitarioCalculado,
        desconto: parseFloat(desconto) || 0,
        valorPago: parseFloat(valorPago) || 0,
        produtosIncluidos: produtos.length > 0
          ? produtos.map(({ nome, quantidade, valorUnitario }) => ({ nome, quantidade, valorUnitario }))
          : undefined,
      };

      await onSubmit(data);
      handleClear(true);
      if (keepOpen) {
        focusClienteInput();
      } else {
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Erro ao criar sessão:', error);
    } finally {
      setIsSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, dataSessaoCompleta, categoria, pacote, valorBasePacote, qtdFotosExtra, totalFotosExtraManual, desconto, valorPago, produtos, onSubmit, handleClear, focusClienteInput]);

  const handleSubmit = () => doSubmit(false);
  const handleSubmitAndAddAnother = () => doSubmit(true);

  // Atalhos de teclado globais (escopo no container)
  useEffect(() => {
    if (!isOpen) return;
    const node = containerRef.current;
    if (!node) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Enter -> Salvar
      if (isCtrl && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      // Ctrl+Shift+Enter -> Salvar e adicionar outra
      if (isCtrl && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        handleSubmitAndAddAnother();
        return;
      }
      // Ctrl+S -> Salvar
      if (isCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      // Ctrl+P -> Adicionar produto
      if (isCtrl && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handleAddProduct();
        return;
      }
      // Ctrl+L -> Limpar
      if (isCtrl && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        handleClear();
        return;
      }
      // Esc -> Fechar
      if (e.key === 'Escape') {
        // Se houver algum dropdown aberto dentro, deixa ele tratar
        const hasOpenDropdown = node.querySelector('[data-radix-popper-content-wrapper]');
        if (hasOpenDropdown) return;
        e.preventDefault();
        handleClose();
        return;
      }
    };

    node.addEventListener('keydown', handler);
    return () => node.removeEventListener('keydown', handler);
  }, [isOpen, handleAddProduct, handleClear, handleClose, doSubmit]);

  const formatCurrency = (value: any) => {
    return `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;
  };

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
            {/* Linha 1 - Dados Básicos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1" data-quick-session-cliente>
                <Label className="text-xs">Cliente *</Label>
                <ClientSearchCombobox
                  value={clienteId}
                  onSelect={setClienteId}
                  placeholder="Buscar cliente..."
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="qs-dia">
                  Dia * <span className="text-muted-foreground font-normal">
                    ({getMonthName(currentMonth.month)} {currentMonth.year})
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="qs-dia"
                    type="number"
                    min="1"
                    max="31"
                    value={diaSessao}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 31)) {
                        setDiaSessao(val);
                      }
                    }}
                    placeholder="DD"
                    className="h-7 text-xs w-16"
                  />
                  <span className="text-xs text-muted-foreground">
                    / {String(currentMonth.month).padStart(2, '0')} / {currentMonth.year}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center justify-between">
                  <span>Pacote</span>
                  {pacote && (
                    <button
                      type="button"
                      onClick={handleClearPackage}
                      className="text-2xs text-muted-foreground hover:text-destructive"
                    >
                      (limpar)
                    </button>
                  )}
                </Label>
                <PackageCombobox
                  value={pacote}
                  onValueChange={handlePackageChange}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Categoria *{autoFilledByPackage && categoria && ' (auto)'}
                </Label>
                <CategoryCombobox
                  value={categoria}
                  disabled={autoFilledByPackage && !!categoria}
                  categoryOptions={categoryOptions}
                  onValueChange={handleCategoryChange}
                />
              </div>
            </div>

            {/* Linha 2 - Valores */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="qs-vlr-pacote">
                  Valor Pacote{autoFilledByPackage && ' (auto)'}
                </Label>
                <Input
                  id="qs-vlr-pacote"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorBasePacote}
                  onChange={(e) => setValorBasePacote(e.target.value)}
                  onFocus={handleNumberInputFocus}
                  readOnly={autoFilledByPackage}
                  placeholder="0.00"
                  className={cn("h-7 text-xs", autoFilledByPackage && "bg-muted/50 cursor-not-allowed")}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="qs-qtd-fotos">Qtd Fotos Extra</Label>
                <Input
                  id="qs-qtd-fotos"
                  type="number"
                  min="0"
                  value={qtdFotosExtra}
                  onChange={(e) => setQtdFotosExtra(e.target.value)}
                  onFocus={handleNumberInputFocus}
                  placeholder="0"
                  className="h-7 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-blue-700 font-medium" htmlFor="qs-total-fotos">Total Fotos Extra *</Label>
                <Input
                  id="qs-total-fotos"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalFotosExtraManual}
                  onChange={(e) => setTotalFotosExtraManual(e.target.value)}
                  onFocus={handleNumberInputFocus}
                  placeholder="247.00"
                  className="h-7 text-xs border-blue-300 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Vlr Foto (calc)</Label>
                <div className="h-7 flex items-center text-xs font-medium text-muted-foreground bg-muted/50 px-2 rounded border">
                  {formatCurrency(valorFotoExtraCalculado)}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="qs-desconto">Desconto</Label>
                <Input
                  id="qs-desconto"
                  type="number"
                  step="0.01"
                  min="0"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  onFocus={handleNumberInputFocus}
                  placeholder="0.00"
                  className="h-7 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-green-700 font-medium" htmlFor="qs-vlr-pago">Valor Pago</Label>
                <Input
                  id="qs-vlr-pago"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorPago}
                  onChange={(e) => setValorPago(e.target.value)}
                  onFocus={handleNumberInputFocus}
                  placeholder="0.00"
                  className="h-7 text-xs border-green-300 focus:border-green-500"
                />
              </div>
            </div>

            {/* Produtos via Combobox */}
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
                        onSelect={(p) => handleProductSelect(index, p)}
                        placeholder={produto.nome || 'Buscar produto...'}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={produto.quantidade}
                        onChange={(e) => handleProductQtyChange(index, parseFloat(e.target.value) || 0)}
                        onFocus={handleNumberInputFocus}
                        placeholder="Qtd"
                        className="h-7 text-xs"
                        data-quick-session-qty={index}
                      />
                    </div>
                    <div className="col-span-2 text-2xs text-muted-foreground text-right">
                      {produto.valorUnitario > 0 ? `× ${formatCurrency(produto.valorUnitario)}` : '—'}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="text-xs font-semibold">
                        {formatCurrency(produto.quantidade * produto.valorUnitario)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProduct(index)}
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
                  onClick={handleAddProduct}
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

            {/* Totais Calculados */}
            <div className="flex items-center justify-end gap-6 p-3 bg-muted/50 rounded-md border flex-wrap">
              <div className="text-xs">
                <span className="text-muted-foreground">Total Fotos:</span>{' '}
                <span className="font-semibold">{formatCurrency(parseFloat(totalFotosExtraManual) || 0)}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Total Produtos:</span>{' '}
                <span className="font-semibold">{formatCurrency(totalProdutos)}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">TOTAL SESSÃO:</span>{' '}
                <span className="font-bold text-lg">{formatCurrency(totalSessao)}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Pago:</span>{' '}
                <span className="font-semibold text-green-600">{formatCurrency(parseFloat(valorPago) || 0)}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Restante:</span>{' '}
                <span className={cn("font-semibold", restante > 0 ? "text-orange-600" : "text-green-600")}>
                  {formatCurrency(restante)}
                </span>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                <Keyboard className="h-3 w-3" />
                <span>
                  <kbd className="px-1 py-0.5 bg-muted border rounded text-2xs">Ctrl</kbd>+
                  <kbd className="px-1 py-0.5 bg-muted border rounded text-2xs">Enter</kbd> salvar
                  · <kbd className="px-1 py-0.5 bg-muted border rounded text-2xs">Ctrl</kbd>+
                  <kbd className="px-1 py-0.5 bg-muted border rounded text-2xs">P</kbd> produto
                  · <kbd className="px-1 py-0.5 bg-muted border rounded text-2xs">Esc</kbd> fechar
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleClear()}
                    >
                      Limpar
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <span className="text-xs">Atalho: Ctrl + L</span>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleSubmitAndAddAnother}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Salvando...' : 'Salvar e Adicionar Outra'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <span className="text-xs">Atalho: Ctrl + Shift + Enter</span>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isSubmitting ? 'Salvando...' : 'Salvar Sessão'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <span className="text-xs">Atalho: Ctrl + Enter</span>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          </TooltipProvider>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
