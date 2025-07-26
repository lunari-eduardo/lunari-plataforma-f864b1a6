import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';
import { WorkflowPackageCombobox } from './WorkflowPackageCombobox';
import { ProductCombobox } from './ProductCombobox';
import { formatCurrency } from '@/utils/financialUtils';
import { formatToDayMonth } from '@/utils/dateUtils';
import { toast } from 'sonner';
import { Package, MessageCircle, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProdutoWorkflow {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
}

interface SessionData {
  id: string;
  data: string;
  nome: string;
  descricao?: string;
  email?: string;
  whatsapp?: string;
  status: string;
  categoria?: string;
  pacote?: string;
  valorPacote?: string;
  desconto?: number;
  valorFotoExtra?: string;
  qtdFotosExtra?: number;
  valorTotalFotoExtra?: string;
  produto?: string;
  qtdProduto?: number;
  valorTotalProduto?: string;
  valorAdicional?: string;
  detalhes?: string;
  valorPago?: string;
  produtosList?: Array<{
    nome: string;
    quantidade: number;
    valorUnitario: number;
    tipo: 'incluso' | 'adicional';
  }>;
}

interface ColumnConfig {
  [key: string]: {
    width: string;
    label: string;
    fixed?: boolean;
  };
}

interface ProductOption {
  id: string;
  nome: string;
  valor: string;
}

interface WorkflowTableProps {
  sessions: SessionData[];
  statusOptions: string[];
  categoryOptions?: any[];
  packageOptions?: any[];
  productOptions: ProductOption[];
  visibleColumns: Record<string, boolean>;
  onFieldUpdate: (sessionId: string, field: string, value: any) => void;
  onStatusChange: (sessionId: string, newStatus: string) => void;
  [key: string]: any; // Allow additional props
}

const columnConfig: ColumnConfig = {
  date: { width: '60px', label: 'Data', fixed: true },
  client: { width: '160px', label: 'Nome', fixed: true },
  description: { width: '140px', label: 'Descrição' },
  email: { width: '200px', label: 'E-mail' },
  status: { width: '120px', label: 'Status' },
  category: { width: '100px', label: 'Categoria' },
  package: { width: '140px', label: 'Pacote' },
  packageValue: { width: '80px', label: 'Valor Pacote' },
  discount: { width: '80px', label: 'Desconto' },
  extraPhotoValue: { width: '80px', label: 'Val. Foto Extra' },
  extraPhotoQty: { width: '60px', label: 'Qtd Fotos' },
  extraPhotoTotal: { width: '80px', label: 'Total Fotos' },
  product: { width: '160px', label: 'Produto' },
  productQty: { width: '60px', label: 'Qtd' },
  productTotal: { width: '80px', label: 'Total Produto' },
  additionalValue: { width: '80px', label: 'Valor Adicional' },
  details: { width: '140px', label: 'Detalhes' },
  total: { width: '80px', label: 'Total' },
  paid: { width: '80px', label: 'Pago' },
  remaining: { width: '80px', label: 'Restante' },
  payment: { width: '100px', label: 'Pagamento' }
};

export function WorkflowTable({ 
  sessions, 
  statusOptions, 
  productOptions, 
  visibleColumns, 
  onFieldUpdate, 
  onStatusChange 
}: WorkflowTableProps) {
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const getEditingKey = (sessionId: string, field: string) => `${sessionId}-${field}`;

  const handleEditStart = (sessionId: string, field: string, currentValue: string) => {
    const key = getEditingKey(sessionId, field);
    setEditingValues(prev => ({ ...prev, [key]: currentValue }));
  };

  const handleEditChange = (sessionId: string, field: string, value: string) => {
    const key = getEditingKey(sessionId, field);
    setEditingValues(prev => ({ ...prev, [key]: value }));
  };

  const handleEditFinish = (sessionId: string, field: string) => {
    const key = getEditingKey(sessionId, field);
    const value = editingValues[key];
    if (value !== undefined) {
      handleFieldUpdateStable(sessionId, field, value);
      setEditingValues(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }
  };

  const handleFieldUpdateStable = useCallback((sessionId: string, field: string, value: any) => {
    onFieldUpdate(sessionId, field, value);
  }, [onFieldUpdate]);

  const calculateTotal = (session: SessionData): number => {
    const valorPacote = parseFloat((session.valorPacote || '0').replace(/[^\\d,]/g, '').replace(',', '.')) || 0;
    const desconto = session.desconto || 0;
    const valorFotoExtra = parseFloat((session.valorTotalFotoExtra || '0').replace(/[^\\d,]/g, '').replace(',', '.')) || 0;
    const valorProduto = parseFloat((session.valorTotalProduto || '0').replace(/[^\\d,]/g, '').replace(',', '.')) || 0;
    const valorAdicional = parseFloat((session.valorAdicional || '0').replace(/[^\\d,]/g, '').replace(',', '.')) || 0;
    
    const produtosTotal = session.produtosList?.reduce((acc, produto) => {
      if (produto.tipo === 'adicional') {
        return acc + (produto.quantidade * produto.valorUnitario);
      }
      return acc;
    }, 0) || 0;

    return valorPacote - desconto + valorFotoExtra + valorProduto + valorAdicional + produtosTotal;
  };

  const calculateRestante = (session: SessionData): number => {
    const total = calculateTotal(session);
    const pago = parseFloat((session.valorPago || '0').replace(/[^\\d,]/g, '').replace(',', '.')) || 0;
    return total - pago;
  };

  const handlePaymentAdd = (sessionId: string) => {
    const amount = paymentInputs[sessionId];
    if (!amount || amount === '0') return;

    const currentPaid = parseFloat((sessions.find(s => s.id === sessionId)?.valorPago || '0').replace(/[^\\d,]/g, '').replace(',', '.')) || 0;
    const additionalAmount = parseFloat(amount.replace(',', '.')) || 0;
    const newTotal = currentPaid + additionalAmount;

    handleFieldUpdateStable(sessionId, 'valorPago', formatCurrency(newTotal));
    setPaymentInputs(prev => ({ ...prev, [sessionId]: '' }));
    toast.success(`Pagamento de R$ ${amount.replace('.', ',')} adicionado com sucesso!`);
  };

  const handlePaymentKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      handlePaymentAdd(sessionId);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, sessionId: string, field: string) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const renderEditableInput = useCallback((session: SessionData, field: string, value: string, type: string = 'text', placeholder: string = '') => {
    const key = getEditingKey(session.id, field);
    const editingValue = editingValues[key];
    const displayValue = editingValue !== undefined ? editingValue : value || '';
    return (
      <Input 
        type={type} 
        value={displayValue} 
        onFocus={() => handleEditStart(session.id, field, value || '')}
        onChange={e => handleEditChange(session.id, field, e.target.value)} 
        onBlur={() => handleEditFinish(session.id, field)}
        onKeyPress={e => handleKeyPress(e, session.id, field)} 
        className="h-6 text-xs p-1 w-full border-none bg-transparent focus:bg-lunar-accent/10 transition-colors duration-150" 
        placeholder={placeholder} 
        autoComplete="off" 
      />
    );
  }, [editingValues, handleFieldUpdateStable]);

  const handleStatusChangeStable = useCallback((sessionId: string, newStatus: string) => {
    onStatusChange(sessionId, newStatus);
  }, [onStatusChange]);

  useEffect(() => {
    const updateScrollState = () => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        const maxScrollLeft = scrollWidth - clientWidth;
        
        setScrollPercent(maxScrollLeft > 0 ? (scrollLeft / maxScrollLeft) * 100 : 0);
        setMaxScroll(maxScrollLeft);
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < maxScrollLeft);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollState);
      updateScrollState();
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', updateScrollState);
      }
    };
  }, [sessions]);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const visibleColumnKeys = Object.keys(visibleColumns).filter(key => visibleColumns[key]);
  const totalWidth = visibleColumnKeys.reduce((acc, key) => {
    const width = parseInt(columnConfig[key]?.width.replace('px', '') || '100');
    return acc + width;
  }, 0);

  const renderHeaderCell = (key: string, label: string) => {
    if (!visibleColumns[key]) return null;
    
    const config = columnConfig[key];
    const isFixed = config?.fixed;
    
    return (
      <th
        key={key}
        className={cn(
          "h-12 px-4 text-left align-middle font-medium text-gray-700 text-xs bg-gray-50/50 border-r border-gray-100 last:border-r-0",
          isFixed && "sticky bg-gray-50/90 backdrop-blur-sm z-20",
          key === 'date' && isFixed && "left-0",
          key === 'client' && isFixed && "left-[60px]"
        )}
        style={{ width: config?.width, minWidth: config?.width }}
      >
        {label}
      </th>
    );
  };

  const renderCell = (key: string, content: React.ReactNode, isFixed: boolean = false) => {
    if (!visibleColumns[key]) return null;
    
    const config = columnConfig[key];
    
    return (
      <td
        key={key}
        className={cn(
          "p-4 align-middle text-xs border-r border-gray-50 last:border-r-0",
          isFixed && "sticky bg-inherit z-10",
          key === 'date' && isFixed && "left-0",
          key === 'client' && isFixed && "left-[60px]"
        )}
        style={{ width: config?.width, minWidth: config?.width }}
      >
        {content}
      </td>
    );
  };

  return (
    <div className="space-y-4">
      {/* Scroll indicator */}
      {maxScroll > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-1">
          <div 
            className="bg-blue-600 h-1 rounded-full transition-all duration-300" 
            style={{ width: `${scrollPercent}%` }}
          />
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="relative w-full overflow-x-auto border border-gray-100 rounded-lg bg-white shadow-sm"
        style={{ minWidth: '100%' }}
      >
        <table
          className="w-full caption-bottom text-sm bg-white"
          style={{ minWidth: `${totalWidth}px` }}
        >
          <thead className="sticky top-0 z-30 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
            <tr>
              {renderHeaderCell('date', 'Data')}
              {renderHeaderCell('client', 'Nome')}
              {renderHeaderCell('description', 'Descrição')}
              {renderHeaderCell('email', 'E-mail')}
              {renderHeaderCell('status', 'Status')}
              {renderHeaderCell('category', 'Categoria')}
              {renderHeaderCell('package', 'Pacote')}
              {renderHeaderCell('packageValue', 'Valor Pacote')}
              {renderHeaderCell('discount', 'Desconto')}
              {renderHeaderCell('extraPhotoValue', 'Val. Foto Extra')}
              {renderHeaderCell('extraPhotoQty', 'Qtd Fotos')}
              {renderHeaderCell('extraPhotoTotal', 'Total Fotos')}
              {renderHeaderCell('product', 'Produto')}
              {renderHeaderCell('productQty', 'Qtd')}
              {renderHeaderCell('productTotal', 'Total Produto')}
              {renderHeaderCell('additionalValue', 'Valor Adicional')}
              {renderHeaderCell('details', 'Detalhes')}
              {renderHeaderCell('total', 'Total')}
              {renderHeaderCell('paid', 'Pago')}
              {renderHeaderCell('remaining', 'Restante')}
              {renderHeaderCell('payment', 'Pagamento')}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-gray-50">
            {sessions.map(session => (
              <React.Fragment key={session.id}>
                <tr className="
                  transition-colors duration-150 ease-in-out
                  hover:bg-lunar-accent/5 hover:shadow-sm
                  focus-within:bg-lunar-accent/10 focus-within:shadow-md focus-within:ring-1 focus-within:ring-lunar-accent/20
                ">
                  {renderCell('date', <div className="font-medium">{formatToDayMonth(session.data)}</div>, true)}
                  
                  {renderCell('client', <div className="flex items-center gap-2">
                      <span className="font-medium">{session.nome}</span>
                      {session.whatsapp && <a href={`https://wa.me/${session.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-3 w-3 text-green-600 hover:text-green-700 cursor-pointer" />
                        </a>}
                    </div>, true)}

                  {renderCell('description', renderEditableInput(session, 'descricao', session.descricao || '', 'text', 'Descrição...'))}
                  
                  {renderCell('email', <div className="flex items-center gap-1 max-w-full">
                      <span className="text-xs select-all cursor-text truncate">{session.email || 'N/A'}</span>
                      {session.email && <a href={`mailto:${session.email}`}>
                          
                        </a>}
                    </div>)}

                  {renderCell('status', <Select key={`status-${session.id}-${session.status}`} value={session.status} onValueChange={value => handleStatusChangeStable(session.id, value)}>
                      <SelectTrigger className="h-auto p-2 text-xs w-full border-none bg-transparent hover:bg-gray-50">
                        <SelectValue asChild>
                          <StatusBadge status={session.status} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-white border shadow-lg">
                        {statusOptions.map(status => <SelectItem key={status} value={status} className="text-xs p-2">
                            <StatusBadge status={status} />
                          </SelectItem>)}
                      </SelectContent>
                    </Select>)}

                  {renderCell('category', <span className="text-xs font-medium">{session.categoria || 'N/A'}</span>)}

                  {renderCell('package', <WorkflowPackageCombobox key={`package-${session.id}-${session.pacote}`} value={session.pacote} onValueChange={packageData => {
                  // Atualizar dados do pacote (congelamento)
                  handleFieldUpdateStable(session.id, 'pacote', packageData.nome);
                  handleFieldUpdateStable(session.id, 'valorPacote', packageData.valor);
                  handleFieldUpdateStable(session.id, 'valorFotoExtra', packageData.valorFotoExtra);
                  handleFieldUpdateStable(session.id, 'categoria', packageData.categoria);

                  // Recalcular total de fotos extras se houver quantidade
                  if (session.qtdFotosExtra > 0) {
                    const valorUnit = parseFloat(packageData.valorFotoExtra.replace(/[^\\d,]/g, '').replace(',', '.')) || 0;
                    handleFieldUpdateStable(session.id, 'valorTotalFotoExtra', formatCurrency(session.qtdFotosExtra * valorUnit));
                  }
                }} />)}

                  {renderCell('packageValue', renderEditableInput(session, 'valorPacote', session.valorPacote || '', 'text', 'R$ 0,00'))}

                  {renderCell('discount', renderEditableInput(session, 'desconto', String(session.desconto || 0), 'number', '0'))}

                  {renderCell('extraPhotoValue', renderEditableInput(session, 'valorFotoExtra', session.valorFotoExtra || '', 'text', 'R$ 0,00'))}

                  {renderCell('extraPhotoQty', <Input key={`photoQty-${session.id}-${session.qtdFotosExtra}`} type="number" value={session.qtdFotosExtra || 0} onChange={e => {
                  const qtd = parseInt(e.target.value) || 0;
                  const valorUnit = parseFloat((session.valorFotoExtra || '0').replace(/[^\\d,]/g, '').replace(',', '.')) || 0;
                  handleFieldUpdateStable(session.id, 'qtdFotosExtra', qtd);
                  handleFieldUpdateStable(session.id, 'valorTotalFotoExtra', formatCurrency(qtd * valorUnit));
                }} className="h-6 text-xs p-1 w-full border-none bg-transparent focus:bg-lunar-accent/10 transition-colors duration-150" placeholder="0" autoComplete="off" />)}

                  {renderCell('extraPhotoTotal', <span className="text-xs font-medium text-green-600">{session.valorTotalFotoExtra || 'R$ 0,00'}</span>)}

                  {renderCell('product', <TooltipProvider>
                      <div className="flex items-center gap-1">
                        {/* Exibir produtos múltiplos se existirem */}
                        {session.produtosList && session.produtosList.length > 0 ? <div className="flex items-center gap-1 w-full">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-pointer">
                                  <Package className="h-3 w-3 text-blue-600" />
                                  <span className="text-xs font-medium text-blue-700">
                                    {session.produtosList.length} produtos
                                  </span>
                                  <Button variant="ghost" size="sm" onClick={() => setExpandedProducts(prev => ({
                              ...prev,
                              [session.id]: !prev[session.id]
                            }))} className="h-4 w-4 p-0">
                                    {expandedProducts[session.id] ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  {session.produtosList.map((produto, idx) => <div key={idx} className="text-xs flex justify-between gap-2">
                                      <span>{produto.nome}</span>
                                      <span className="font-medium">
                                        {produto.quantidade}x
                                        {produto.tipo === 'incluso' ? ' (Incluso)' : ` - R$ ${produto.valorUnitario.toFixed(2)}`}
                                      </span>
                                    </div>)}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div> : (/* Sistema antigo para compatibilidade */
                    <ProductCombobox key={`product-${session.id}-${session.produto}`} value={session.produto} onValueChange={productData => {
                      if (productData) {
                        handleFieldUpdateStable(session.id, 'produto', productData.nome);
                        const qtd = session.qtdProduto || 1;
                        const valorUnit = parseFloat(productData.valor.replace(/[^\\d,]/g, '').replace(',', '.')) || 0;
                        handleFieldUpdateStable(session.id, 'valorTotalProduto', formatCurrency(qtd * valorUnit));
                      } else {
                        // Limpar produto
                        handleFieldUpdateStable(session.id, 'produto', '');
                        handleFieldUpdateStable(session.id, 'qtdProduto', 0);
                        handleFieldUpdateStable(session.id, 'valorTotalProduto', 'R$ 0,00');
                      }
                    }} productOptions={productOptions} onClear={() => {
                      handleFieldUpdateStable(session.id, 'produto', '');
                      handleFieldUpdateStable(session.id, 'qtdProduto', 0);
                      handleFieldUpdateStable(session.id, 'valorTotalProduto', 'R$ 0,00');
                    }} />)}
                      </div>
                    </TooltipProvider>)}

                  {renderCell('productQty', <Input key={`productQty-${session.id}-${session.qtdProduto}`} type="number" value={session.qtdProduto || 0} onChange={e => {
                  const qtd = parseInt(e.target.value) || 0;
                  handleFieldUpdateStable(session.id, 'qtdProduto', qtd);
                  if (session.produto) {
                    const productData = productOptions.find(p => p.nome === session.produto);
                    if (productData) {
                      const valorUnit = parseFloat(productData.valor.replace(/[^\\d,]/g, '').replace(',', '.')) || 0;
                      handleFieldUpdateStable(session.id, 'valorTotalProduto', formatCurrency(qtd * valorUnit));
                    }
                  }
                }} className="h-6 text-xs p-1 w-full border-none bg-transparent focus:bg-lunar-accent/10 transition-colors duration-150" placeholder="0" autoComplete="off" />)}

                  {renderCell('productTotal', renderEditableInput(session, 'valorTotalProduto', session.valorTotalProduto || '', 'text', 'R$ 0,00'))}

                  {renderCell('additionalValue', renderEditableInput(session, 'valorAdicional', session.valorAdicional || '', 'text', 'R$ 0,00'))}

                  {renderCell('details', renderEditableInput(session, 'detalhes', session.detalhes || '', 'text', 'Observações...'))}

                  {renderCell('total', <span className="font-bold text-blue-700 text-xs">{formatCurrency(calculateTotal(session))}</span>)}

                  {renderCell('paid', renderEditableInput(session, 'valorPago', session.valorPago || '', 'text', 'R$ 0,00'))}

                  {renderCell('remaining', <span className="font-bold text-orange-600 text-xs">{formatCurrency(calculateRestante(session))}</span>)}

                  {renderCell('payment', <div className="flex items-center gap-1 w-full">
                      <Input type="number" placeholder="0,00" value={paymentInputs[session.id] || ''} onChange={e => setPaymentInputs(prev => ({
                    ...prev,
                    [session.id]: e.target.value
                  }))} onKeyDown={e => handlePaymentKeyDown(e, session.id)} className="h-6 text-xs p-1 flex-1 border-none bg-transparent focus:bg-lunar-accent/10 transition-colors duration-150" autoComplete="off" />
                      <Button variant="ghost" size="sm" onClick={() => handlePaymentAdd(session.id)} className="h-6 w-6 p-0 shrink-0">
                        <span className="text-xs font-bold">+</span>
                      </Button>
                    </div>)}
                </tr>
                
                {/* Linha expandida para mostrar todos os produtos */}
                {expandedProducts[session.id] && session.produtosList && session.produtosList.length > 0 && (
                  <tr key={`${session.id}-expanded`} className="
                    transition-colors duration-150 ease-in-out
                    hover:bg-lunar-accent/5 hover:shadow-sm
                    focus-within:bg-lunar-accent/10 focus-within:shadow-md focus-within:ring-1 focus-within:ring-lunar-accent/20
                    bg-blue-50
                  ">
                    <td colSpan={Object.keys(visibleColumns).filter(key => visibleColumns[key]).length} className="p-3">
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-blue-800">📦 Produtos Detalhados</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {session.produtosList.map((produto, idx) => (
                            <div key={idx} className="bg-white p-2 rounded border border-blue-200">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-gray-800">{produto.nome}</p>
                                  <p className="text-xs text-gray-600">Qtd: {produto.quantidade}</p>
                                </div>
                                <div className="text-right">
                                  <span className={`text-xs px-2 py-1 rounded ${produto.tipo === 'incluso' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {produto.tipo === 'incluso' ? 'Incluso' : `R$ ${produto.valorUnitario.toFixed(2)}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Navigation Buttons with Tailwind's built-in pulse animation */}
      {maxScroll > 0 && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-6">
          <Button
            variant="outline"
            size="sm"
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            className={cn(
              "bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200",
              !canScrollLeft && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="bg-white px-3 py-1 rounded-full shadow-lg border border-gray-200">
            <span className="text-xs font-medium text-gray-600">{Math.round(scrollPercent)}%</span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={scrollRight}
            disabled={!canScrollRight}
            className={cn(
              "bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200",
              !canScrollRight && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
