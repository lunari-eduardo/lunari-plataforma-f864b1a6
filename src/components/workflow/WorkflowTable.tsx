import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkflowPackageCombobox } from "./WorkflowPackageCombobox";
import { StatusBadge } from "./StatusBadge";
import { GerenciarProdutosModal } from "./GerenciarProdutosModal";
import { MessageCircle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Package, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatToDayMonth } from "@/utils/dateUtils";
import { calculateTotals } from '@/services/FinancialCalculationEngine';
import { calcularTotalFotosExtras, obterConfiguracaoPrecificacao, obterTabelaGlobal, obterTabelaCategoria, calcularValorPorFoto, formatarMoeda } from '@/utils/precificacaoUtils';
import { RegrasCongeladasIndicator } from './RegrasCongeladasIndicator';
import { RegrasPrecoFotoExtraCongeladas } from '@/contexts/AppContext';
interface ProdutoWorkflow {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
}
interface SessionData {
  id: string;
  data: string;
  hora: string;
  nome: string;
  email: string;
  descricao: string;
  status: string;
  whatsapp: string;
  categoria: string;
  pacote: string;
  valorPacote: string;
  valorFotoExtra: string;
  qtdFotosExtra: number;
  valorTotalFotoExtra: string;
  produto: string;
  qtdProduto: number;
  valorTotalProduto: string;
  produtosList?: ProdutoWorkflow[]; // LISTA COMPLETA DE PRODUTOS
  valorAdicional: string;
  detalhes: string;
  observacoes: string;
  valor: string;
  total: string;
  valorPago: string;
  restante: string;
  desconto: number;
  // NOVO: Campo para regras congeladas
  regrasDePrecoFotoExtraCongeladas?: RegrasPrecoFotoExtraCongeladas;
}
interface WorkflowTableProps {
  sessions: SessionData[];
  statusOptions: string[];
  categoryOptions: any[];
  packageOptions: any[];
  productOptions: any[];
  onStatusChange: (id: string, newStatus: string) => void;
  onEditSession: (id: string) => void;
  onAddPayment: (id: string) => void;
  onFieldUpdate: (id: string, field: string, value: any) => void;
  visibleColumns: Record<string, boolean>;
  columnWidths: Record<string, number>;
  onScrollChange: (scrollLeft: number) => void;
  onColumnWidthChange?: (widths: Record<string, number>) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}
const desktopColumnWidths = {
  date: 80,
  client: 200,
  description: 200,
  email: 180,
  status: 150,
  category: 150,
  package: 180,
  packageValue: 120,
  discount: 100,
  extraPhotoValue: 100,
  extraPhotoQty: 80,
  extraPhotoTotal: 100,
  product: 150,
  productQty: 80,
  productTotal: 100,
  additionalValue: 100,
  details: 200,
  total: 120,
  paid: 120,
  remaining: 120,
  payment: 120
};
const tabletColumnWidths = {
  date: 70,
  client: 140,
  description: 140,
  email: 140,
  status: 120,
  category: 120,
  package: 140,
  packageValue: 100,
  discount: 80,
  extraPhotoValue: 80,
  extraPhotoQty: 60,
  extraPhotoTotal: 80,
  product: 120,
  productQty: 60,
  productTotal: 80,
  additionalValue: 80,
  details: 140,
  total: 100,
  paid: 100,
  remaining: 100,
  payment: 100
};
const mobileColumnWidths = {
  date: 60,
  client: 100,
  description: 100,
  email: 100,
  status: 100,
  category: 100,
  package: 120,
  packageValue: 80,
  discount: 60,
  extraPhotoValue: 60,
  extraPhotoQty: 50,
  extraPhotoTotal: 60,
  product: 100,
  productQty: 50,
  productTotal: 60,
  additionalValue: 60,
  details: 100,
  total: 80,
  paid: 80,
  remaining: 80,
  payment: 80
};
const useResponsiveColumnWidths = () => {
  const [currentWidths, setCurrentWidths] = useState(desktopColumnWidths);
  useEffect(() => {
    const updateWidths = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setCurrentWidths(mobileColumnWidths);
      } else if (width < 1024) {
        setCurrentWidths(tabletColumnWidths);
      } else {
        setCurrentWidths(desktopColumnWidths);
      }
    };
    updateWidths();
    window.addEventListener('resize', updateWidths);
    return () => window.removeEventListener('resize', updateWidths);
  }, []);
  return currentWidths;
};
export function WorkflowTable({
  sessions,
  statusOptions,
  categoryOptions,
  packageOptions,
  productOptions,
  onStatusChange,
  onEditSession,
  onAddPayment,
  onFieldUpdate,
  visibleColumns,
  columnWidths = desktopColumnWidths,
  onColumnWidthChange,
  onScrollChange,
  sortField,
  sortDirection,
  onSort
}: WorkflowTableProps) {
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [sessionSelecionada, setSessionSelecionada] = useState<SessionData | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const navIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollSpeedRef = useRef(1);
  const accelerationRef = useRef(0);
  const responsiveColumnWidths = useResponsiveColumnWidths();

  // Estados para redimensionamento de colunas
  const [resizing, setResizing] = useState<string | null>(null);
  const [initialMouseX, setInitialMouseX] = useState(0);
  const [initialWidth, setInitialWidth] = useState(0);
  const [currentColumnWidths, setCurrentColumnWidths] = useState<Record<string, number>>({});
  const [modeloPrecificacao, setModeloPrecificacao] = useState('fixo');

  // Atualizar larguras quando columnWidths prop mudar
  useEffect(() => {
    setCurrentColumnWidths({
      ...responsiveColumnWidths,
      ...columnWidths
    });
  }, [columnWidths, responsiveColumnWidths]);

  // Escutar mudanças no modelo de precificação
  useEffect(() => {
    const config = obterConfiguracaoPrecificacao();
    setModeloPrecificacao(config.modelo);
    const handleModeloChange = (event: CustomEvent) => {
      const novoModelo = event.detail.novoModelo;
      setModeloPrecificacao(novoModelo);

      // Força re-render suave para atualizar campos "Vlr Foto"
      // Isso irá atualizar os valores dinamicamente
    };
    window.addEventListener('precificacao-modelo-changed', handleModeloChange as EventListener);
    return () => {
      window.removeEventListener('precificacao-modelo-changed', handleModeloChange as EventListener);
    };
  }, []);
  const handleFieldUpdateStable = useCallback((sessionId: string, field: string, value: any) => {
    console.log('Updating field:', field, 'for session:', sessionId, 'with value:', value);
    onFieldUpdate(sessionId, field, value);
  }, [onFieldUpdate]);
  const handlePaymentAdd = useCallback((sessionId: string) => {
    const value = paymentInputs[sessionId];
    if (value && !isNaN(parseFloat(value))) {
      const paymentValue = parseFloat(value);

      // Atualizar o valor pago diretamente
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        const valorPagoStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
        const currentPaid = parseFloat(valorPagoStr.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
        const newPaidValue = currentPaid + paymentValue;

        // Formatar o novo valor pago
        const formattedValue = `R$ ${newPaidValue.toFixed(2).replace('.', ',')}`;
        handleFieldUpdateStable(sessionId, 'valorPago', formattedValue);
      }

      // Limpar o campo após adicionar
      setPaymentInputs(prev => ({
        ...prev,
        [sessionId]: ''
      }));
    }
  }, [paymentInputs, sessions, handleFieldUpdateStable]);
  const handlePaymentKeyDown = useCallback((e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePaymentAdd(sessionId);
    }
  }, [handlePaymentAdd]);
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const maxScrollLeft = scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth;
      onScrollChange(scrollLeft);
      setScrollPercent(maxScrollLeft > 0 ? scrollLeft / maxScrollLeft * 100 : 0);
      setMaxScroll(maxScrollLeft);
    }
  }, [onScrollChange]);
  const startContinuousScroll = useCallback((direction: 'left' | 'right') => {
    if (navIntervalRef.current) {
      clearInterval(navIntervalRef.current);
      navIntervalRef.current = null;
    }
    scrollSpeedRef.current = 2;
    accelerationRef.current = 0;
    const performScroll = () => {
      if (scrollContainerRef.current) {
        accelerationRef.current += 0.5;
        const currentSpeed = Math.min(scrollSpeedRef.current + accelerationRef.current, 50);
        const scrollAmount = direction === 'left' ? -currentSpeed : currentSpeed;
        scrollContainerRef.current.scrollBy({
          left: scrollAmount,
          behavior: 'auto'
        });
      }
    };
    performScroll();
    navIntervalRef.current = setInterval(performScroll, 16);
  }, []);
  const stopContinuousScroll = useCallback(() => {
    if (navIntervalRef.current) {
      clearInterval(navIntervalRef.current);
      navIntervalRef.current = null;
    }
    accelerationRef.current = 0;
    scrollSpeedRef.current = 2;
  }, []);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, {
        passive: true
      });
      handleScroll();
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);
  useEffect(() => {
    return () => {
      stopContinuousScroll();
    };
  }, [stopContinuousScroll]);
  const calculateTotal = useCallback((session: SessionData) => {
    try {
      // LÓGICA SIMPLIFICADA: Calcular baseado nos componentes - desconto
      const valorPacoteStr = typeof session.valorPacote === 'string' ? session.valorPacote : String(session.valorPacote || '0');
      const valorPacote = parseFloat(valorPacoteStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const valorFotoExtraStr = typeof session.valorTotalFotoExtra === 'string' ? session.valorTotalFotoExtra : String(session.valorTotalFotoExtra || '0');
      const valorFotoExtra = parseFloat(valorFotoExtraStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const valorAdicionalStr = typeof session.valorAdicional === 'string' ? session.valorAdicional : String(session.valorAdicional || '0');
      const valorAdicional = parseFloat(valorAdicionalStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const desconto = session.desconto || 0;

      // Apenas produtos manuais somam ao total
      let valorProdutosManuais = 0;
      if (session.produtosList && session.produtosList.length > 0) {
        const produtosManuais = session.produtosList.filter(p => p.tipo === 'manual');
        valorProdutosManuais = produtosManuais.reduce((total, p) => total + p.valorUnitario * p.quantidade, 0);
      } else if (session.valorTotalProduto) {
        const valorProdutoStr = typeof session.valorTotalProduto === 'string' ? session.valorTotalProduto : String(session.valorTotalProduto || '0');
        valorProdutosManuais = parseFloat(valorProdutoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      }
      const totalCalculado = valorPacote + valorFotoExtra + valorProdutosManuais + valorAdicional - desconto;
      console.log('💰 Total calculado para', session.nome, ':', {
        valorPacote,
        valorFotoExtra,
        valorProdutosManuais,
        valorAdicional,
        desconto,
        totalFinal: totalCalculado
      });
      return totalCalculado;
    } catch (error) {
      console.error('Erro no cálculo de total:', error);
      return 0;
    }
  }, []);
  const calculateRestante = useCallback((session: SessionData) => {
    const total = calculateTotal(session);
    const valorPagoStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
    const valorPago = parseFloat(valorPagoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    return total - valorPago;
  }, [calculateTotal]);
  const formatCurrency = useCallback((value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }, []);
  const getEditingKey = (sessionId: string, field: string) => `${sessionId}-${field}`;
  const handleEditStart = (sessionId: string, field: string, currentValue: string) => {
    const key = getEditingKey(sessionId, field);
    setEditingValues(prev => ({
      ...prev,
      [key]: currentValue
    }));
  };
  const handleEditChange = (sessionId: string, field: string, newValue: string) => {
    const key = getEditingKey(sessionId, field);
    setEditingValues(prev => ({
      ...prev,
      [key]: newValue
    }));
  };
  const handleEditFinish = (sessionId: string, field: string) => {
    const key = getEditingKey(sessionId, field);
    const newValue = editingValues[key];
    if (newValue !== undefined) {
      handleFieldUpdateStable(sessionId, field, newValue);

      // Recalcular valor total das fotos extras quando o valor unitário for alterado
      if (field === 'valorFotoExtra') {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
          const valorUnit = parseFloat(newValue.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
          const qtd = session.qtdFotosExtra || 0;
          handleFieldUpdateStable(sessionId, 'valorTotalFotoExtra', formatCurrency(qtd * valorUnit));
        }
      }

      // SISTEMA DE CONGELAMENTO: Recalcular quando quantidade de fotos extras for alterada
      if (field === 'qtdFotosExtra') {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
          const novaQuantidade = parseInt(newValue) || 0;
          
          // Buscar o item correspondente no contexto para verificar regras congeladas
          console.log('🧮 Recalculando fotos extras para sessão:', sessionId, 'quantidade:', novaQuantidade);
          
          // Como não temos acesso direto às regras congeladas aqui, 
          // vamos disparar o recálculo através do contexto
          setTimeout(() => {
            handleFieldUpdateStable(sessionId, 'qtdFotoExtra', novaQuantidade);
          }, 0);
        }
      }
      setEditingValues(prev => {
        const updated = {
          ...prev
        };
        delete updated[key];
        return updated;
      });
    }
  };
  const handleKeyPress = (e: React.KeyboardEvent, sessionId: string, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditFinish(sessionId, field);
      (e.target as HTMLInputElement).blur();
    }
  };
  const renderEditableInput = useCallback((session: SessionData, field: string, value: string, type: string = 'text', placeholder: string = '') => {
    const key = getEditingKey(session.id, field);
    const editingValue = editingValues[key];
    const displayValue = editingValue !== undefined ? editingValue : value || '';
    return <Input type={type} value={displayValue} onFocus={() => {
      handleEditStart(session.id, field, value || '');
    }} onChange={e => handleEditChange(session.id, field, e.target.value)} onBlur={() => {
      handleEditFinish(session.id, field);
    }} onKeyPress={e => handleKeyPress(e, session.id, field)} className="h-6 text-xs p-1 w-full border-none bg-transparent focus:bg-lunar-accent/10 transition-colors duration-150" placeholder={placeholder} autoComplete="off" />;
  }, [editingValues, handleFieldUpdateStable]);
  const handleStatusChangeStable = useCallback((sessionId: string, newStatus: string) => {
    onStatusChange(sessionId, newStatus);
  }, [onStatusChange]);
  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };
  // Handlers para redimensionamento
  const handleMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    setResizing(columnKey);
    setInitialMouseX(e.clientX);
    setInitialWidth(currentColumnWidths[columnKey] || responsiveColumnWidths[columnKey]);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [currentColumnWidths, responsiveColumnWidths]);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const diff = e.clientX - initialMouseX;
    const newWidth = Math.max(60, initialWidth + diff); // Largura mínima de 60px

    setCurrentColumnWidths(prev => ({
      ...prev,
      [resizing]: newWidth
    }));
  }, [resizing, initialMouseX, initialWidth]);
  const handleMouseUp = useCallback(() => {
    if (resizing && onColumnWidthChange) {
      onColumnWidthChange(currentColumnWidths);
    }
    setResizing(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [resizing, currentColumnWidths, onColumnWidthChange]);
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);
  const renderHeaderCell = (key: string, label: string, sortable: boolean = false, isFixed: boolean = false) => {
    if (!visibleColumns[key]) return null;
    const width = currentColumnWidths[key] || responsiveColumnWidths[key];
    return <th key={key} className={`
          relative bg-lunar-surface border-r border-gray-200 p-2 text-left text-xs font-medium text-gray-700
          ${isFixed ? 'sticky z-20 shadow-sm' : ''}
        `} style={{
      width: `${width}px`,
      minWidth: `${width}px`,
      maxWidth: `${width}px`,
      left: isFixed ? key === 'date' ? '0px' : `${currentColumnWidths.date || responsiveColumnWidths.date}px` : undefined
    }}>
        {sortable ? <div onClick={() => onSort(key)} className="flex items-center justify-between cursor-pointer hover:text-blue-600">
            <span>{label}</span>
            {getSortIcon(key)}
          </div> : <span>{label}</span>}
        
        {/* Divisor para redimensionamento */}
        <div className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 hover:opacity-50 transition-all" onMouseDown={e => handleMouseDown(e, key)} style={{
        background: resizing === key ? 'rgba(59, 130, 246, 0.5)' : 'transparent'
      }} />
      </th>;
  };
  const renderCell = useCallback((key: string, content: React.ReactNode, isFixed = false) => {
    if (!visibleColumns[key]) return null;
    const width = currentColumnWidths[key] || responsiveColumnWidths[key];
    return <td className={`
          p-2 border-r border-gray-100 min-h-[40px] text-xs transition-colors duration-150 ease-in-out
          ${isFixed ? 'sticky z-10 bg-white shadow-sm group-hover:bg-gray-50 group-focus-within:bg-blue-50' : 'group-hover:bg-lunar-surface/50 group-focus-within:bg-lunar-accent/10'}
        `} style={{
      width: `${width}px`,
      minWidth: `${width}px`,
      maxWidth: `${width}px`,
      left: isFixed ? key === 'date' ? '0px' : `${currentColumnWidths.date || responsiveColumnWidths.date}px` : undefined
    }}>
        {content}
      </td>;
  }, [visibleColumns, currentColumnWidths, responsiveColumnWidths]);
  return <div className="relative flex flex-col h-full bg-white">
      {/* NÍVEL 1: O "BOX DE ROLAGEM" */}
      <div ref={scrollContainerRef} className="h-full w-full overflow-auto" style={{
      height: 'calc(100vh - 280px)'
    }}>
          {/* NÍVEL 2: A TABELA ÚNICA COM LARGURA AUTOMÁTICA */}
        <table className="w-full border-collapse lg:min-w-[1200px] md:min-w-[800px] min-w-[600px]" style={{
        width: 'max-content',
        position: 'relative',
        tableLayout: 'auto'
      }}>
          {/* NÍVEL 3: O CABEÇALHO STICKY */}
          <thead className="sticky top-0 z-30 bg-white border-b-2 border-gray-200">
            <tr>
              {renderHeaderCell('date', 'Data', true, true)}
              {renderHeaderCell('client', 'Nome', true, true)}
              {renderHeaderCell('description', 'Descrição')}
              {renderHeaderCell('email', 'E-mail')}
              {renderHeaderCell('status', 'Status', true)}
              {renderHeaderCell('category', 'Categoria')}
              {renderHeaderCell('package', 'Pacote')}
              {renderHeaderCell('packageValue', 'Vlr Pacote', true)}
              {renderHeaderCell('discount', 'Desconto')}
              {renderHeaderCell('extraPhotoValue', 'Vlr Foto')}
              {renderHeaderCell('extraPhotoQty', 'Qtd Foto')}
              {renderHeaderCell('extraPhotoTotal', 'Total Foto')}
              {renderHeaderCell('product', 'Produto')}
              {renderHeaderCell('productTotal', 'Total Prod')}
              {renderHeaderCell('additionalValue', 'Adicional')}
              {renderHeaderCell('details', 'Obs')}
              {renderHeaderCell('total', 'TOTAL', true)}
              {renderHeaderCell('paid', 'PAGO', true)}
              {renderHeaderCell('remaining', 'RESTANTE', true)}
              {renderHeaderCell('payment', 'Pagamento')}
            </tr>
          </thead>
          
          {/* NÍVEL 4: O CORPO DA TABELA */}
          <tbody className="divide-y divide-gray-50">
            {sessions.map(session => {
            return <>
                <tr key={session.id} className="group transition-colors duration-150 ease-in-out">
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
                    const valorUnit = parseFloat(packageData.valorFotoExtra.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                    handleFieldUpdateStable(session.id, 'valorTotalFotoExtra', formatCurrency(session.qtdFotosExtra * valorUnit));
                  }
                }} />)}

                {renderCell('packageValue', renderEditableInput(session, 'valorPacote', session.valorPacote || '', 'text', 'R$ 0,00'))}

                {renderCell('discount', renderEditableInput(session, 'desconto', String(session.desconto || 0), 'number', '0'))}

                {renderCell('extraPhotoValue', (() => {
                  // SISTEMA DE CONGELAMENTO: Mostrar indicador das regras e valor correspondente
                  const hasRegrasCongeladas = Boolean(session.regrasDePrecoFotoExtraCongeladas);
                  
                  return <div className="flex flex-col gap-1 h-auto min-h-[24px]">
                      {/* Indicador de regras congeladas */}
                      <RegrasCongeladasIndicator 
                        regras={session.regrasDePrecoFotoExtraCongeladas} 
                        compact={true} 
                      />
                      
                      {/* Valor da foto */}
                      {hasRegrasCongeladas ? (
                        // Item com regras congeladas: mostrar valor calculado (somente leitura)
                        <span className="text-xs font-medium text-blue-600">
                          {session.valorFotoExtra || 'R$ 0,00'}
                        </span>
                      ) : (
                        // Item sem regras congeladas: permitir edição
                        renderEditableInput(session, 'valorFotoExtra', session.valorFotoExtra || '', 'text', 'R$ 0,00')
                      )}
                    </div>;
                })())}

                {renderCell('extraPhotoQty', <Input key={`photoQty-${session.id}-${session.qtdFotosExtra}`} type="number" value={session.qtdFotosExtra || 0} onChange={e => {
                  const qtd = parseInt(e.target.value) || 0;
                  handleFieldUpdateStable(session.id, 'qtdFotosExtra', qtd);

                  // Usar o novo motor de cálculo inteligente
                  const valorFotoExtra = parseFloat((session.valorFotoExtra || '0').replace(/[^\d,]/g, '').replace(',', '.')) || 0;

                  // Buscar ID da categoria pelo nome
                  const categorias = JSON.parse(localStorage.getItem('configuracoes_categorias') || '[]');
                  const categoriaObj = categorias.find((cat: any) => cat.nome === session.categoria);
                  const categoriaId = categoriaObj?.id || session.categoria;
                  const total = calcularTotalFotosExtras(qtd, {
                    valorFotoExtra,
                    categoria: session.categoria,
                    categoriaId
                  });
                  handleFieldUpdateStable(session.id, 'valorTotalFotoExtra', formatCurrency(total));
                }} className="h-6 text-xs p-1 w-full border-none bg-transparent focus:bg-lunar-accent/10 transition-colors duration-150" placeholder="0" autoComplete="off" />)}

                {renderCell('extraPhotoTotal', <span className="text-xs font-medium text-green-600">{session.valorTotalFotoExtra || 'R$ 0,00'}</span>)}

                {renderCell('product', <Button variant="ghost" size="sm" onClick={() => {
                  setSessionSelecionada(session);
                  setModalAberto(true);
                }} className="h-6 p-2 text-xs justify-start hover:bg-blue-50 w-full">
                    {session.produtosList && session.produtosList.length > 0 ? <div className="flex items-center gap-1">
                        <Package className="h-3 w-3 text-blue-600" />
                        <span className="text-blue-700 font-medium">
                          {session.produtosList.length} produtos
                        </span>
                      </div> : <div className="flex items-center gap-1 text-muted-foreground">
                        <Plus className="h-3 w-3" />
                        <span>Adicionar</span>
                      </div>}
                  </Button>)}


                {renderCell('productTotal', <span className="text-xs font-medium text-green-600">
                    {session.produtosList && session.produtosList.length > 0 ? formatCurrency(session.produtosList.filter(p => p.tipo === 'manual').reduce((total, p) => total + p.valorUnitario * p.quantidade, 0)) : session.valorTotalProduto || 'R$ 0,00'}
                  </span>)}

                {renderCell('additionalValue', renderEditableInput(session, 'valorAdicional', session.valorAdicional || '', 'text', 'R$ 0,00'))}

                {renderCell('details', renderEditableInput(session, 'observacoes', session.observacoes || '', 'text', 'Observações...'))}

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
               </>;
          })}
          </tbody>
        </table>
      </div>

      {/* Navigation Buttons with Tailwind's built-in pulse animation */}
      {maxScroll > 0 && <div className="fixed bottom-20 md:bottom-8 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-6">
          <Button variant="ghost" size="icon" onMouseDown={() => startContinuousScroll('left')} onMouseUp={stopContinuousScroll} onMouseLeave={stopContinuousScroll} onTouchStart={() => startContinuousScroll('left')} onTouchEnd={stopContinuousScroll} disabled={scrollPercent <= 1} className={`h-12 w-12 rounded-full bg-white/40 backdrop-blur-sm shadow-lg border border-gray-200/50 hover:bg-white/60 transition-all duration-300 ease-out hover:scale-110 active:scale-95 disabled:opacity-30 ${scrollPercent <= 1 ? '' : 'animate-pulse'}`}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" onMouseDown={() => startContinuousScroll('right')} onMouseUp={stopContinuousScroll} onMouseLeave={stopContinuousScroll} onTouchStart={() => startContinuousScroll('right')} onTouchEnd={stopContinuousScroll} disabled={scrollPercent >= 99} className={`h-12 w-12 rounded-full bg-white/40 backdrop-blur-sm shadow-lg border border-gray-200/50 hover:bg-white/60 transition-all duration-300 ease-out hover:scale-110 active:scale-95 disabled:opacity-30 ${scrollPercent >= 99 ? '' : 'animate-pulse'}`}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>}
        
        {/* Modal de Gerenciamento de Produtos */}
        {sessionSelecionada && <GerenciarProdutosModal open={modalAberto} onOpenChange={setModalAberto} sessionId={sessionSelecionada.id} clienteName={sessionSelecionada.nome} produtos={sessionSelecionada.produtosList || []} productOptions={productOptions} onSave={novosProdutos => {
      // Atualizar a lista de produtos e recalcular totais
      handleFieldUpdateStable(sessionSelecionada.id, 'produtosList', novosProdutos);

      // Garantir que produtos inclusos sempre tenham valor 0
      const produtosCorrigidos = novosProdutos.map(p => ({
        ...p,
        valorUnitario: p.tipo === 'incluso' ? 0 : p.valorUnitario
      }));

      // Atualizar campos de compatibilidade
      const produtosManuais = produtosCorrigidos.filter(p => p.tipo === 'manual');
      const valorTotalManuais = produtosManuais.reduce((total, p) => total + p.valorUnitario * p.quantidade, 0);
      if (produtosManuais.length > 0) {
        const nomesProdutos = produtosManuais.map(p => p.nome).join(', ');
        const nomesInclusos = produtosCorrigidos.filter(p => p.tipo === 'incluso').map(p => p.nome);
        const nomeCompleto = nomesInclusos.length > 0 ? `${nomesProdutos} + ${nomesInclusos.length} incluso(s)` : nomesProdutos;
        handleFieldUpdateStable(sessionSelecionada.id, 'produto', nomeCompleto);
        handleFieldUpdateStable(sessionSelecionada.id, 'qtdProduto', produtosManuais.reduce((total, p) => total + p.quantidade, 0));
      } else if (produtosCorrigidos.filter(p => p.tipo === 'incluso').length > 0) {
        const produtosInclusos = produtosCorrigidos.filter(p => p.tipo === 'incluso');
        handleFieldUpdateStable(sessionSelecionada.id, 'produto', `${produtosInclusos.length} produto(s) incluso(s)`);
        handleFieldUpdateStable(sessionSelecionada.id, 'qtdProduto', 0);
      } else {
        handleFieldUpdateStable(sessionSelecionada.id, 'produto', '');
        handleFieldUpdateStable(sessionSelecionada.id, 'qtdProduto', 0);
      }
      handleFieldUpdateStable(sessionSelecionada.id, 'valorTotalProduto', formatCurrency(valorTotalManuais));
      setSessionSelecionada(null);
    }} />}
    </div>;
}