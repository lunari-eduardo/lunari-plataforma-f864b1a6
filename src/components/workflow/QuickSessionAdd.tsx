import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ClientSearchCombobox from '@/components/agenda/ClientSearchCombobox';
import { PackageCombobox } from '@/components/workflow/PackageCombobox';
import { CategoryCombobox } from '@/components/workflow/CategoryCombobox';
import { useOrcamentoData } from '@/hooks/useOrcamentoData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ManualProduct {
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

interface QuickSessionData {
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
  produtosIncluidos?: ManualProduct[];
  detalhes?: string;
  observacoes?: string;
}

interface QuickSessionAddProps {
  onSubmit: (data: QuickSessionData) => Promise<void>;
}

export function QuickSessionAdd({ onSubmit }: QuickSessionAddProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch categories from database
  const { categorias } = useOrcamentoData();
  
  // Form fields
  const [clienteId, setClienteId] = useState('');
  const [dataSessao, setDataSessao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pacote, setPacote] = useState('');
  // Status removido - dados históricos são sempre 'concluído' por padrão
  const [valorBasePacote, setValorBasePacote] = useState('0');
  const [qtdFotosExtra, setQtdFotosExtra] = useState('0');
  const [valorFotoExtra, setValorFotoExtra] = useState('0');
  const [desconto, setDesconto] = useState('0');
  const [produtos, setProdutos] = useState<ManualProduct[]>([]);
  
  // Track if category was auto-filled by package
  const [categoryFromPackage, setCategoryFromPackage] = useState(false);
  
  // Calculated values
  const [totalFotoExtra, setTotalFotoExtra] = useState(0);
  const [totalProdutos, setTotalProdutos] = useState(0);
  const [totalSessao, setTotalSessao] = useState(0);
  const [restante, setRestante] = useState(0);

  // Map categories to options format
  const categoryOptions = categorias.map((nome, index) => ({
    id: String(index + 1),
    nome
  }));

  // Calculate totals in real-time
  useEffect(() => {
    const qtd = parseFloat(qtdFotosExtra) || 0;
    const valorUnit = parseFloat(valorFotoExtra) || 0;
    const total = qtd * valorUnit;
    setTotalFotoExtra(total);
  }, [qtdFotosExtra, valorFotoExtra]);

  useEffect(() => {
    const total = produtos.reduce((sum, p) => {
      return sum + (p.quantidade * p.valorUnitario);
    }, 0);
    setTotalProdutos(total);
  }, [produtos]);

  useEffect(() => {
    const valorPacote = parseFloat(valorBasePacote) || 0;
    const desc = parseFloat(desconto) || 0;
    
    const total = valorPacote + totalFotoExtra + totalProdutos - desc;
    setTotalSessao(Math.max(0, total));
    setRestante(Math.max(0, total)); // Sem pagamentos iniciais
  }, [valorBasePacote, totalFotoExtra, totalProdutos, desconto]);

  const handleAddProduct = () => {
    setProdutos([...produtos, { nome: '', quantidade: 1, valorUnitario: 0 }]);
  };

  const handleRemoveProduct = (index: number) => {
    setProdutos(produtos.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, field: keyof ManualProduct, value: string | number) => {
    const newProdutos = [...produtos];
    newProdutos[index] = { ...newProdutos[index], [field]: value };
    setProdutos(newProdutos);
  };

  // Handle package selection - auto-fill category and values
  const handlePackageChange = (packageData: {
    nome: string;
    valor: string;
    valorFotoExtra: string;
    categoria: string;
  }) => {
    setPacote(packageData.nome);
    
    // Parse currency strings to numbers
    const valorNum = parseFloat(packageData.valor.replace('R$ ', '').replace('.', '').replace(',', '.')) || 0;
    const valorFotoNum = parseFloat(packageData.valorFotoExtra.replace('R$ ', '').replace('.', '').replace(',', '.')) || 0;
    
    setValorBasePacote(valorNum.toString());
    setValorFotoExtra(valorFotoNum.toString());
    
    // Auto-fill category
    if (packageData.categoria) {
      setCategoria(packageData.categoria);
      setCategoryFromPackage(true);
    }
  };

  // Handle category change - only allow if not auto-filled by package
  const handleCategoryChange = (newCategory: string) => {
    setCategoria(newCategory);
    setCategoryFromPackage(false);
  };

  const validateForm = (): boolean => {
    if (!clienteId) {
      toast.error('Selecione um cliente');
      return false;
    }
    if (!dataSessao) {
      toast.error('Informe a data da sessão');
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
    
    // Validate products
    for (const produto of produtos) {
      if (!produto.nome.trim()) {
        toast.error('Todos os produtos devem ter nome');
        return false;
      }
      if (produto.quantidade <= 0) {
        toast.error('Quantidade do produto deve ser maior que zero');
        return false;
      }
    }
    
    return true;
  };

  const handleClear = () => {
    setClienteId('');
    setDataSessao('');
    setCategoria('');
    setPacote('');
    setValorBasePacote('0');
    setQtdFotosExtra('0');
    setValorFotoExtra('0');
    setDesconto('0');
    setProdutos([]);
    setCategoryFromPackage(false);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const data: QuickSessionData = {
        clienteId,
        dataSessao,
        horaSessao: '00:00', // Default hour for historical sessions
        categoria,
        pacote: pacote.trim() || undefined,
        status: 'concluído', // Dados históricos sempre são concluídos
        valorBasePacote: parseFloat(valorBasePacote) || 0,
        qtdFotosExtra: parseFloat(qtdFotosExtra) || 0,
        valorFotoExtra: parseFloat(valorFotoExtra) || 0,
        desconto: parseFloat(desconto) || 0,
        produtosIncluidos: produtos.length > 0 ? produtos : undefined,
      };
      
      await onSubmit(data);
      handleClear();
      setIsOpen(false);
    } catch (error) {
      console.error('Erro ao criar sessão:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  return (
    <div className="mb-4 border border-dashed border-primary/30 rounded-lg bg-primary/5">
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
          <div className="p-4 space-y-4">
          {/* Linha 1 - Dados Básicos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cliente *</Label>
                <ClientSearchCombobox
                  value={clienteId}
                  onSelect={setClienteId}
                  placeholder="Buscar cliente..."
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Data *</Label>
                <Input
                  type="date"
                  value={dataSessao}
                  onChange={(e) => setDataSessao(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Pacote</Label>
                <PackageCombobox
                  value={pacote}
                  onValueChange={handlePackageChange}
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Categoria *{categoryFromPackage && ' (auto)'}</Label>
                <CategoryCombobox
                  value={categoria}
                  disabled={categoryFromPackage}
                  categoryOptions={categoryOptions}
                  onValueChange={handleCategoryChange}
                />
              </div>
            </div>

            {/* Linha 2 - Valores */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor Pacote{pacote && ' (auto)'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorBasePacote}
                  onChange={(e) => !pacote && setValorBasePacote(e.target.value)}
                  readOnly={!!pacote}
                  placeholder="0.00"
                  className={cn("h-7 text-xs", pacote && "bg-muted/50 cursor-not-allowed")}
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Qtd Fotos Extra</Label>
                <Input
                  type="number"
                  min="0"
                  value={qtdFotosExtra}
                  onChange={(e) => setQtdFotosExtra(e.target.value)}
                  placeholder="0"
                  className="h-7 text-xs"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Vlr Foto Extra{pacote && ' (auto)'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorFotoExtra}
                  onChange={(e) => !pacote && setValorFotoExtra(e.target.value)}
                  readOnly={!!pacote}
                  placeholder="0.00"
                  className={cn("h-7 text-xs", pacote && "bg-muted/50 cursor-not-allowed")}
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Desconto</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  placeholder="0.00"
                  className="h-7 text-xs"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Total Fotos Extra</Label>
                <div className="h-7 flex items-center text-xs font-medium text-muted-foreground bg-muted/50 px-2 rounded border">
                  {formatCurrency(totalFotoExtra)}
                </div>
              </div>
            </div>

            {/* Produtos Manuais */}
            {produtos.length > 0 && (
              <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Produtos Manuais</Label>
                </div>
                {produtos.map((produto, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <Input
                        type="text"
                        value={produto.nome}
                        onChange={(e) => handleProductChange(index, 'nome', e.target.value)}
                        placeholder="Nome do produto"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        value={produto.quantidade}
                        onChange={(e) => handleProductChange(index, 'quantidade', parseFloat(e.target.value) || 0)}
                        placeholder="Qtd"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={produto.valorUnitario}
                        onChange={(e) => handleProductChange(index, 'valorUnitario', parseFloat(e.target.value) || 0)}
                        placeholder="Valor unit."
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(produto.quantidade * produto.valorUnitario)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProduct(index)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

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

            {/* Totais Calculados */}
            <div className="flex items-center justify-end gap-6 p-3 bg-muted/50 rounded-md border">
              <div className="text-xs">
                <span className="text-muted-foreground">Total Fotos:</span>{' '}
                <span className="font-semibold">{formatCurrency(totalFotoExtra)}</span>
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
                <span className="text-muted-foreground">Restante:</span>{' '}
                <span className="font-semibold text-orange-600">{formatCurrency(restante)}</span>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
              >
                Limpar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Sessão'}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
