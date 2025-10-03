import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import debounce from 'lodash.debounce';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { WorkflowPackageCombobox } from "./WorkflowPackageCombobox";
import { StatusBadge } from "./StatusBadge";
import { GerenciarProdutosModal } from "./GerenciarProdutosModal";
import { WorkflowPaymentsModal } from "./WorkflowPaymentsModal";
import { FlexibleDeleteModal } from "./FlexibleDeleteModal";
import { AuditInfo } from "./AuditInfo";
import { MessageCircle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Package, Plus, CreditCard, Calendar, CheckCircle, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppContext } from '@/contexts/AppContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useNumberInput } from '@/hooks/useNumberInput';
import { formatToDayMonth, formatDateForDisplay } from "@/utils/dateUtils";
import { calcularTotalFotosExtras, obterConfiguracaoPrecificacao, obterTabelaGlobal, obterTabelaCategoria, calcularValorPorFoto, formatarMoeda, calcularComRegrasProprias, migrarRegrasParaItemAntigo } from '@/utils/precificacaoUtils';
import { RegrasCongeladasIndicator } from './RegrasCongeladasIndicator';
import { AutoPhotoCalculator } from './AutoPhotoCalculator';
import { DataFreezingStatus } from './DataFreezingStatus';
import type { SessionData } from '@/types/workflow';
import { useConfiguration } from '@/hooks/useConfiguration';
import { usePricingMigration } from '@/hooks/usePricingMigration';
interface WorkflowTableProps {
  sessions: SessionData[];
  statusOptions: string[];
  categoryOptions: any[];
  packageOptions: any[];
  productOptions: any[];
  onStatusChange: (id: string, newStatus: string) => void;
  onEditSession: (id: string) => void;
  onAddPayment: (id: string) => void;
  onDeleteSession?: (id: string, sessionTitle: string, paymentCount: number) => void;
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
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
  onDeleteSession,
  onFieldUpdate,
  visibleColumns,
  columnWidths = desktopColumnWidths,
  onColumnWidthChange,
  onScrollChange,
  sortField,
  sortDirection,
  onSort
}: WorkflowTableProps) {
  const { categorias } = useConfiguration();
  const { executarMigracaoSeNecessario } = usePricingMigration();
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [sessionSelecionada, setSessionSelecionada] = useState<SessionData | null>(null);
  const [workflowPaymentsOpen, setWorkflowPaymentsOpen] = useState(false);
  const [selectedSessionForPayment, setSelectedSessionForPayment] = useState<SessionData | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<{
    id: string;
    title: string;
    paymentCount: number;
  } | null>(null);
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
  const {
    addPayment
  } = useAppContext();

  // Stable field update callback with silent option
  const handleFieldUpdateStable = useCallback((sessionId: string, field: string, value: any, silent: boolean = false) => {
    console.log('🔧 WorkflowTable: Field update for session:', sessionId, 'field:', field, 'value:', value, 'silent:', silent);
    onFieldUpdate(sessionId, field, value, silent);
  }, [onFieldUpdate]);

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

  // Função para calcular valor real por foto baseado nas regras congeladas
  const calcularValorRealPorFoto = useCallback((session: SessionData) => {
    if (session.regrasDePrecoFotoExtraCongeladas) {
      const regras = session.regrasDePrecoFotoExtraCongeladas;
      switch (regras.modelo) {
        case 'fixo':
          return regras.valorFixo || 0;
        case 'global':
        case 'categoria':
          const tabela = regras.modelo === 'global' ? regras.tabelaGlobal : regras.tabelaCategoria;
          if (!tabela || !tabela.faixas || tabela.faixas.length === 0) {
            return 0;
          }

          // Para tabelas progressivas, mostrar o valor da faixa atual baseado na quantidade
          const quantidade = session.qtdFotosExtra || 1;
          const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);
          for (const faixa of faixasOrdenadas) {
            if (quantidade >= faixa.min && (faixa.max === null || quantidade <= faixa.max)) {
              return faixa.valor;
            }
          }

          // Se não encontrou faixa, usar a última faixa
          return faixasOrdenadas[faixasOrdenadas.length - 1]?.valor || 0;
        default:
          return 0;
      }
    } else {
      // Item sem regras congeladas - usar valor fixo
      const valorStr = typeof session.valorFotoExtra === 'string' ? session.valorFotoExtra : String(session.valorFotoExtra || '0');
      return parseFloat(valorStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    }
  }, []);
  const calculateTotal = useCallback((session: SessionData) => {
    try {
      // LÓGICA SIMPLIFICADA: Calcular baseado nos componentes - desconto
      const valorPacoteStr = typeof session.valorPacote === 'string' ? session.valorPacote : String(session.valorPacote || '0');
      const valorPacote = parseFloat(valorPacoteStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const valorFotoExtraStr = typeof session.valorTotalFotoExtra === 'string' ? session.valorTotalFotoExtra : String(session.valorTotalFotoExtra || '0');
      const valorFotoExtra = parseFloat(valorFotoExtraStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const valorAdicionalStr = typeof session.valorAdicional === 'string' ? session.valorAdicional : String(session.valorAdicional || '0');
      const valorAdicional = parseFloat(valorAdicionalStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const desconto = parseFloat(String(session.desconto || 0).replace(/[^\d,]/g, '').replace(',', '.')) || 0;

      // Apenas produtos manuais somam ao total
      let valorProdutosManuais = 0;
      if (session.produtosList && session.produtosList.length > 0) {
        const produtosManuais = session.produtosList.filter(p => p.tipo === 'manual');
        valorProdutosManuais = produtosManuais.reduce((total, p) => {
          const valorUnit = parseFloat(String(p.valorUnitario || 0)) || 0;
          const quantidade = parseFloat(String(p.quantidade || 0)) || 0;
          return total + valorUnit * quantidade;
        }, 0);
      } else if (session.valorTotalProduto) {
        const valorProdutoStr = typeof session.valorTotalProduto === 'string' ? session.valorTotalProduto : String(session.valorTotalProduto || '0');
        valorProdutosManuais = parseFloat(valorProdutoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      }
      const totalCalculado = valorPacote + valorFotoExtra + valorProdutosManuais + valorAdicional - desconto;

      // Garantir que o resultado é um número válido
      if (isNaN(totalCalculado) || !isFinite(totalCalculado)) {
        console.warn('❌ Total calculado é NaN para sessão:', session.id, {
          valorPacote,
          valorFotoExtra,
          valorProdutosManuais,
          valorAdicional,
          desconto
        });
        return 0;
      }
      return Math.max(0, totalCalculado); // Garantir que não seja negativo
    } catch (error) {
      console.error('❌ Erro no cálculo de total para sessão:', session.id, error);
      return 0;
    }
  }, []);
  const calculateRestante = useCallback((session: SessionData) => {
    const total = calculateTotal(session);
    const valorPagoStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
    const valorPago = parseFloat(valorPagoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    const restante = total - valorPago;

    // Garantir que o resultado é um número válido
    if (isNaN(restante) || !isFinite(restante)) {
      console.warn('❌ Restante calculado é NaN para sessão:', session.id, {
        total,
        valorPago
      });
      return 0;
    }
    return restante;
  }, [calculateTotal]);

  // Função para detectar pagamentos agendados/parcelados
  const getPaymentPlanInfo = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || !session.pagamentos || !Array.isArray(session.pagamentos)) {
      return {
        hasScheduled: false,
        hasPaid: false
      };
    }
    const hasPendingPayments = session.pagamentos.some(p => p.statusPagamento === 'pendente');
    const hasPaidPayments = session.pagamentos.some(p => p.statusPagamento === 'pago');
    const hasInstallments = session.pagamentos.some(p => p.tipo === 'parcelado');
    return {
      hasScheduled: hasPendingPayments,
      hasPaid: hasPaidPayments,
      hasInstallments,
      totalPending: session.pagamentos.filter(p => p.statusPagamento === 'pendente').reduce((acc, p) => acc + (p.valor || 0), 0)
    };
  }, [sessions]);
  const handlePaymentAdd = useCallback((sessionId: string) => {
    const value = paymentInputs[sessionId];
    if (value && !isNaN(parseFloat(value))) {
      const paymentValue = parseFloat(value);

      // Usar a função addPayment do contexto
      addPayment(sessionId, paymentValue);

      // Limpar o campo após adicionar
      setPaymentInputs(prev => ({
        ...prev,
        [sessionId]: ''
      }));

      // Forçar re-render para atualizar valores na tabela
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('workflow-data-changed'));
      }, 100);
    }
  }, [paymentInputs, addPayment]);
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
  const handleEditFinish = useCallback(async (sessionId: string, field: string) => {
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

          // Importar e usar o AutoPhotoCalculator para recálculo
          const { pricingFreezingService } = await import('@/services/PricingFreezingService');
          
          if (session.regrasDePrecoFotoExtraCongeladas) {
            // Tentar usar regras congeladas se disponível
            try {
              const resultado = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
                novaQuantidade, 
                session.regrasDePrecoFotoExtraCongeladas as any
              );
              
              handleFieldUpdateStable(sessionId, 'valorFotoExtra', formatCurrency(resultado.valorUnitario));
              handleFieldUpdateStable(sessionId, 'valorTotalFotoExtra', formatCurrency(resultado.valorTotal));
            } catch (error) {
              console.warn('⚠️ Erro usando regras congeladas, usando valor fixo:', error);
              const valorUnit = calcularValorRealPorFoto(session);
              handleFieldUpdateStable(sessionId, 'valorTotalFotoExtra', formatCurrency(novaQuantidade * valorUnit));
            }
          } else {
            // Usar valor atual fixo
            const valorUnit = calcularValorRealPorFoto(session);
            handleFieldUpdateStable(sessionId, 'valorTotalFotoExtra', formatCurrency(novaQuantidade * valorUnit));
          }
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
  }, [editingValues, sessions, handleFieldUpdateStable, calcularValorRealPorFoto, formatCurrency]);
  const handleKeyPress = (e: React.KeyboardEvent, sessionId: string, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditFinish(sessionId, field);
      (e.target as HTMLInputElement).blur();
    }
  };
  const renderEditableInput = useCallback((session: SessionData, field: string, value: string, type: string = 'text', placeholder: string = '', readonly: boolean = false) => {
    const key = getEditingKey(session.id, field);
    const editingValue = editingValues[key];
    const displayValue = editingValue !== undefined ? editingValue : value || '';

    // Campos que precisam de formatação monetária
    const isMoneyField = ['desconto', 'valorTotalFotoExtra', 'valorAdicional'].includes(field);
    return <Input type={type} value={displayValue} readOnly={readonly} onFocus={e => {
      if (!readonly) {
        if (isMoneyField) {
          // Para campos monetários, mostrar apenas o número para edição
          const numericValue = displayValue.replace(/[^\d,]/g, '');
          handleEditStart(session.id, field, numericValue || '0');
          // Selecionar todo o texto para facilitar edição
          setTimeout(() => e.target.select(), 0);
        } else {
          handleEditStart(session.id, field, value || '');
        }
      }
    }} onChange={e => {
      if (!readonly) {
        let newValue = e.target.value;

        // Para campos monetários, permitir apenas números e vírgula durante a digitação
        if (isMoneyField) {
          // Permitir apenas números, vírgula e ponto
          newValue = newValue.replace(/[^\d,\.]/g, '');
          // Substituir ponto por vírgula para padronização brasileira
          newValue = newValue.replace('.', ',');
          // Permitir apenas uma vírgula
          const parts = newValue.split(',');
          if (parts.length > 2) {
            newValue = parts[0] + ',' + parts.slice(1).join('');
          }
          // Limitar casas decimais a 2
          if (parts[1] && parts[1].length > 2) {
            newValue = parts[0] + ',' + parts[1].substring(0, 2);
          }
        }
        handleEditChange(session.id, field, newValue);
      }
    }} onBlur={() => {
      if (!readonly) {
        // Na saída do campo (blur), aplicar formatação final para campos monetários
        if (isMoneyField) {
          const currentValue = editingValues[key] || '';
          if (currentValue) {
            const numericValue = parseFloat(currentValue.replace(',', '.')) || 0;
            const formattedValue = `R$ ${numericValue.toFixed(2).replace('.', ',')}`;
            handleEditChange(session.id, field, formattedValue);
          } else {
            handleEditChange(session.id, field, 'R$ 0,00');
          }
        }
        handleEditFinish(session.id, field);
      }
    }} onKeyPress={e => {
      if (!readonly) {
        handleKeyPress(e, session.id, field);
      }
    }} className={`h-6 text-xs p-1 w-full border-none bg-transparent transition-colors duration-150 ${readonly ? 'cursor-default' : 'focus:bg-lunar-accent/10'}`} placeholder={placeholder} autoComplete="off" />;
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
          relative bg-lunar-surface border-r border-lunar-border p-2 text-left text-xs font-medium text-foreground/80
          ${isFixed ? 'sticky z-20 shadow-sm' : ''}
        `} style={{
      width: `${width}px`,
      minWidth: `${width}px`,
      maxWidth: `${width}px`,
      left: isFixed ? key === 'date' ? '0px' : `${currentColumnWidths.date || responsiveColumnWidths.date}px` : undefined
    }}>
        {sortable ? <div onClick={() => onSort(key)} className="flex items-center justify-between cursor-pointer hover:text-primary">
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
          p-2 border-r border-lunar-border min-h-[40px] text-xs transition-colors duration-150 ease-in-out
          ${isFixed ? 'sticky z-20 bg-lunar-surface shadow-sm' : 'group-hover:bg-lunar-accent/5 group-focus-within:bg-lunar-accent/10'}
          ${key === 'date' ? 'border-l-2 border-l-transparent group-hover:border-l-lunar-accent/40 group-focus-within:border-l-lunar-accent' : ''}
        `} style={{
      width: `${width}px`,
      minWidth: `${width}px`,
      maxWidth: `${width}px`,
      left: isFixed ? key === 'date' ? '0px' : `${currentColumnWidths.date || responsiveColumnWidths.date}px` : undefined
    }}>
        {content}
      </td>;
  }, [visibleColumns, currentColumnWidths, responsiveColumnWidths]);
  return <div className="relative flex flex-col h-full bg-background text-foreground dark:bg-lunar-bg">
      {/* NÍVEL 1: O "BOX DE ROLAGEM" */}
      <div ref={scrollContainerRef} className="h-full w-full overflow-auto bg-background dark:bg-lunar-surface" style={{
      height: 'calc(100vh - 280px)'
    }}>
          {/* NÍVEL 2: A TABELA ÚNICA COM LARGURA AUTOMÁTICA */}
        <table className="w-full border-collapse lg:min-w-[1200px] md:min-w-[800px] min-w-[600px]" style={{
        width: 'max-content',
        position: 'relative',
        tableLayout: 'auto'
      }}>
          {/* NÍVEL 3: O CABEÇALHO STICKY */}
          <thead className="sticky top-0 z-30 bg-lunar-surface border-b-2 border-lunar-border">
            <tr>
              {renderHeaderCell('date', 'Data', true, true)}
              {renderHeaderCell('client', 'Nome', true, true)}
              {renderHeaderCell('description', 'Descrição')}
              {renderHeaderCell('email', 'E-mail')}
              {renderHeaderCell('status', 'Status', true)}
              {renderHeaderCell('category', 'Categoria', true)}
              {renderHeaderCell('package', 'Pacote', true)}
              {renderHeaderCell('packageValue', 'Vlr Pacote', true)}
              {renderHeaderCell('discount', 'Desconto', true)}
              {renderHeaderCell('extraPhotoValue', 'Vlr Foto')}
              {renderHeaderCell('extraPhotoQty', 'Qtd Foto', true)}
              {renderHeaderCell('extraPhotoTotal', 'Total de foto extra', true)}
              {renderHeaderCell('product', 'Produto', true)}
              {renderHeaderCell('productTotal', 'Total Prod', true)}
              {renderHeaderCell('additionalValue', 'Adicional', true)}
              {renderHeaderCell('details', 'Obs')}
              {renderHeaderCell('total', 'TOTAL', true)}
              {renderHeaderCell('paid', 'PAGO', true)}
              {renderHeaderCell('remaining', 'RESTANTE', true)}
              {renderHeaderCell('payment', 'Pagamento')}
            </tr>
          </thead>
          
          {/* NÍVEL 4: O CORPO DA TABELA */}
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sessions.map(session => {
            return <>
                <tr key={session.id} className="group transition-colors duration-150 ease-in-out focus-within:ring-1 focus-within:ring-lunar-accent/30">
                {renderCell('date', <div className="font-medium">{formatToDayMonth(session.data)}</div>, true)}
                
                {renderCell('client', <div className="flex items-center gap-2">
                    {session.clienteId ? <Link to={`/clientes/${session.clienteId}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
                        {session.nome}
                      </Link> : <span className="font-medium text-gray-600">{session.nome}</span>}
                    {session.produtosList && session.produtosList.length > 0 && <Badge variant="secondary" className="h-5 text-[10px] px-1.5">Prod.</Badge>}
                    {session.whatsapp && <a href={`https://wa.me/${session.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-3 w-3 text-green-600 hover:text-green-700 cursor-pointer" />
                      </a>}
                  </div>, true)}

                {renderCell('description', renderEditableInput(session, 'descricao', session.descricao || '', 'text', 'Descrição...'))}
                
                {renderCell('email', <div className="flex items-center gap-1 max-w-full">
                    <span className="text-xs select-all cursor-text truncate font-thin">{session.email || 'N/A'}</span>
                    {session.email && <a href={`mailto:${session.email}`}>
                        
                      </a>}
                  </div>)}

                {renderCell('status', <Select key={`status-${session.id}-${session.status || 'empty'}`} value={session.status || ''} onValueChange={value => handleStatusChangeStable(session.id, value)}>
                    <SelectTrigger className="h-auto p-2 text-xs w-full border-none bg-transparent hover:bg-lunar-accent/5 focus:bg-lunar-accent/10 transition-colors">
                      <SelectValue asChild>
                        <StatusBadge status={session.status || ''} />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-lunar-surface text-foreground border border-lunar-border shadow-lg">
                      {session.status && session.status !== '' && (
                        <SelectItem key="clear-status" value="" className="text-xs p-2 italic text-muted-foreground">
                          Limpar status
                        </SelectItem>
                      )}
                      {statusOptions.map(status => <SelectItem key={status} value={status} className="text-xs p-2">
                          <StatusBadge status={status} />
                        </SelectItem>)}
                    </SelectContent>
                  </Select>)}

                {renderCell('category', <span className="text-xs text-center font-light">{session.categoria || 'N/A'}</span>)}

                {renderCell('package', <div className="flex flex-col gap-1">
                <WorkflowPackageCombobox key={`package-${session.id}-${session.pacote}`} value={session.pacote} onValueChange={packageData => {
                  console.log('🔄 Pacote selecionado - ID:', packageData.id);
                  
                  // CRITICAL FIX: Only call one update - let the hook handle everything else
                  handleFieldUpdateStable(session.id, 'pacote', packageData.id || packageData.nome);
                }} />
                  <DataFreezingStatus regrasCongeladas={session.regrasDePrecoFotoExtraCongeladas} isCompact={true} />
                </div>)}

                {renderCell('packageValue', renderEditableInput(session, 'valorPacote', session.valorPacote || '', 'text', 'R$ 0,00', true))}

                {renderCell('discount', renderEditableInput(session, 'desconto', session.desconto ? `R$ ${(typeof session.desconto === 'number' ? session.desconto : parseFloat(String(session.desconto).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0).toFixed(2).replace('.', ',')}` : 'R$ 0,00', 'text', 'R$ 0,00'))}

                {renderCell('extraPhotoValue', (() => {
                  if (session.regrasDePrecoFotoExtraCongeladas) {
                    // Item com regras congeladas: mostrar valor e modelo aplicado
                    const regras = session.regrasDePrecoFotoExtraCongeladas;
                    const valorExibido = calcularValorRealPorFoto(session);
                    let labelModelo = '';
                    let tooltipInfo = '';
                    switch (regras.modelo) {
                      case 'fixo':
                        labelModelo = 'Fixo';
                        tooltipInfo = `Valor fixo: R$ ${regras.valorFixo?.toFixed(2) || '0,00'}`;
                        break;
                      case 'global':
                        labelModelo = 'Global';
                        tooltipInfo = `Tabela global: ${regras.tabelaGlobal?.nome || 'N/A'}`;
                        break;
                      case 'categoria':
                        labelModelo = 'Categoria';
                        tooltipInfo = `Tabela da categoria: ${regras.tabelaCategoria?.nome || 'N/A'}`;
                        break;
                      default:
                        labelModelo = 'Congelado';
                        tooltipInfo = 'Regras congeladas';
                    }
                    return <div className="flex flex-col gap-1" title={tooltipInfo}>
                        <div className="flex items-center gap-1">
                          <RegrasCongeladasIndicator regras={session.regrasDePrecoFotoExtraCongeladas} compact={true} />
                          <span className="text-xs text-muted-foreground">
                            ({labelModelo})
                          </span>
                        </div>
                        <span className="text-xs font-medium text-blue-600">
                          {formatCurrency(valorExibido)}
                        </span>
                      </div>;
                  } else {
                    // Item sem regras congeladas: calcular valor unitário atual baseado no modelo global
                    const config = obterConfiguracaoPrecificacao();
                    let valorUnitario = 0;
                    if (config.modelo === 'fixo') {
                      // Modelo fixo por pacote - usar valor já armazenado na sessão
                      const valorStr = typeof session.valorFotoExtra === 'string' ? session.valorFotoExtra : String(session.valorFotoExtra || '0');
                      valorUnitario = parseFloat(valorStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                    } else if (config.modelo === 'global') {
                      // Modelo tabela global - calcular valor baseado na quantidade
                      const tabelaGlobal = obterTabelaGlobal();
                      if (tabelaGlobal && session.qtdFotosExtra && session.qtdFotosExtra > 0) {
                        valorUnitario = calcularValorPorFoto(session.qtdFotosExtra, tabelaGlobal);
                      } else if (tabelaGlobal && tabelaGlobal.faixas.length > 0) {
                        valorUnitario = tabelaGlobal.faixas[0].valor;
                      }
                    } else if (config.modelo === 'categoria') {
                      // Modelo por categoria - calcular valor baseado na categoria
                      const categoriaObj = categorias.find((cat) => cat.nome === session.categoria);
                      const categoriaId = categoriaObj?.id || session.categoria;
                      if (categoriaId) {
                        const tabelaCategoria = obterTabelaCategoria(categoriaId);
                        if (tabelaCategoria && session.qtdFotosExtra && session.qtdFotosExtra > 0) {
                          valorUnitario = calcularValorPorFoto(session.qtdFotosExtra, tabelaCategoria);
                        } else if (tabelaCategoria && tabelaCategoria.faixas.length > 0) {
                          valorUnitario = tabelaCategoria.faixas[0].valor;
                        }
                      }
                    }
                    return <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-orange-400 rounded-full" title="Migração necessária" />
                          <span className="text-xs text-orange-600">Migração</span>
                        </div>
                        <span className="text-xs font-medium text-blue-600">
                          {formatCurrency(valorUnitario)}
                        </span>
                      </div>;
                  }
                })())}

                {renderCell('extraPhotoQty', (() => {
                  const ExtraPhotoQtyInput = () => {
                    const [localValue, setLocalValue] = useState(String(session.qtdFotosExtra || ''));
                    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
                    
                    // Debounced save function for real-time updates
                    const debouncedSave = useMemo(
                      () => debounce((qtd: number) => {
                        console.log('📸 Debounced save extra photo qty:', qtd, 'for session:', session.id);
                        if (qtd !== session.qtdFotosExtra) {
                          handleFieldUpdateStable(session.id, 'qtdFotosExtra', qtd);
                        }
                      }, 800), // Increased debounce time to prevent excessive calls
                      [session.id, handleFieldUpdateStable] // Removed session.qtdFotosExtra to prevent recreation
                    );

                    // Cleanup debounce on unmount
                    useEffect(() => {
                      return () => {
                        debouncedSave.cancel();
                      };
                    }, [debouncedSave]);

                    const {
                      displayValue,
                      handleFocus,
                      handleChange
                    } = useNumberInput({
                      value: localValue,
                      onChange: value => {
                        setLocalValue(value);
                        setHasUnsavedChanges(value !== String(session.qtdFotosExtra || ''));
                        
                        // Trigger debounced save for real-time updates only if value actually changed
                        const qtd = parseInt(value) || 0;
                        if (qtd !== session.qtdFotosExtra) {
                          debouncedSave(qtd);
                        }
                      }
                    });
                    
                    const saveValue = () => {
                      const qtd = parseInt(localValue) || 0;
                      console.log('📸 Manual save extra photo qty:', qtd, 'for session:', session.id);
                      if (qtd !== session.qtdFotosExtra) {
                        // Cancel any pending debounced save
                        debouncedSave.cancel();
                        handleFieldUpdateStable(session.id, 'qtdFotosExtra', qtd);
                      }
                      setHasUnsavedChanges(false);
                    };
                    const handleKeyDown = (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveValue();
                        (e.target as HTMLInputElement).blur();
                      }
                    };
                    const handleBlur = () => {
                      if (hasUnsavedChanges) {
                        saveValue();
                      }
                    };
                    return <Input key={`photoQty-${session.id}`} type="number" value={displayValue} onChange={handleChange} onFocus={handleFocus} onKeyDown={handleKeyDown} onBlur={handleBlur} className={`h-6 text-xs p-1 w-full border-none bg-transparent focus:bg-lunar-accent/10 transition-colors duration-150 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${hasUnsavedChanges ? 'bg-yellow-50' : ''}`} placeholder="" autoComplete="off" />;
                  };
                  return <>
                    <ExtraPhotoQtyInput />
                    <AutoPhotoCalculator 
                      sessionId={session.id}
                      quantidade={session.qtdFotosExtra || 0}
                      regrasCongeladas={session.regrasDePrecoFotoExtraCongeladas}
                      currentValorFotoExtra={Number(session.valorFotoExtra) || 0}
                      currentValorTotalFotoExtra={Number(session.valorTotalFotoExtra) || 0}
                      categoria={session.categoria}
                      categoriaId={(() => {
                        // Find category ID from category name
                        const categoria = categorias.find(cat => cat.nome === session.categoria);
                        return categoria?.id;
                      })()}
                      valorFotoExtraPacote={(() => {
                        // Find package extra photo value
                        const pacote = packageOptions.find(pkg => pkg.nome === session.pacote);
                        return pacote?.valorFotoExtra || 0;
                      })()}
                      onValueUpdate={(updates) => {
                        handleFieldUpdateStable(session.id, 'valorFotoExtra', updates.valorFotoExtra, true);
                        handleFieldUpdateStable(session.id, 'valorTotalFotoExtra', updates.valorTotalFotoExtra, true);
                      }}
                    />
                  </>;
                })())}

                {renderCell('extraPhotoTotal', (() => {
                  // Calcular o valor real baseado nas regras
                  let valorCalculado = 0;
                  if (session.regrasDePrecoFotoExtraCongeladas) {
                    // Item com regras congeladas - usar motor de cálculo específico
                    const resultado = calcularComRegrasProprias(session.qtdFotosExtra || 0, session.regrasDePrecoFotoExtraCongeladas);
                    valorCalculado = resultado.valorTotal;
                  } else {
                    // Item sem regras congeladas - usar motor global
                    const valorFotoExtra = parseFloat((session.valorFotoExtra || '0').replace(/[^\d,]/g, '').replace(',', '.')) || 0;

                    // Buscar ID da categoria pelo nome
                    const categoriaObj = categorias.find((cat) => cat.nome === session.categoria);
                    const categoriaId = categoriaObj?.id || session.categoria;
                    valorCalculado = calcularTotalFotosExtras(session.qtdFotosExtra || 0, {
                      valorFotoExtra,
                      categoria: session.categoria,
                      categoriaId
                    });
                  }

                  // Exibir valor da sessão ou calculado em tempo real  
                  const displayTotalValue = session.valorTotalFotoExtra && session.valorTotalFotoExtra !== 'R$ 0,00' 
                    ? session.valorTotalFotoExtra 
                    : formatCurrency(valorCalculado);
                  
                  return <span className={`text-xs ${session.valorTotalFotoExtra && session.valorTotalFotoExtra !== 'R$ 0,00' ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {displayTotalValue}
                  </span>;
                })())}

                {renderCell('product', <Button variant="ghost" size="sm" onClick={() => {
                  setSessionSelecionada(session);
                  setModalAberto(true);
                }} className="h-6 p-2 text-xs justify-start hover:bg-lunar-accent/10 w-full">
                    {session.produtosList && session.produtosList.length > 0 ? (() => {
                      const produtosProduzidos = session.produtosList.filter(p => p.produzido);
                      const todosCompletos = session.produtosList.length > 0 && produtosProduzidos.length === session.produtosList.length;
                      const parcialmenteCompletos = produtosProduzidos.length > 0 && produtosProduzidos.length < session.produtosList.length;
                      
                      return <div className="flex items-center gap-1">
                        <Package className="h-3 w-3 text-blue-600" />
                        <span className="text-blue-700 font-medium">
                          {session.produtosList.length} produtos
                        </span>
                        {todosCompletos && (
                          <div className="w-2 h-2 bg-green-500 rounded-full" title="Todos os produtos foram produzidos" />
                        )}
                        {parcialmenteCompletos && (
                          <div className="w-2 h-2 bg-yellow-500 rounded-full" title={`${produtosProduzidos.length} de ${session.produtosList.length} produtos produzidos`} />
                        )}
                      </div>;
                    })() : <div className="flex items-center gap-1 text-muted-foreground">
                        <Plus className="h-3 w-3" />
                        <span>Adicionar</span>
                      </div>}
                  </Button>)}


                {renderCell('productTotal', <span className="text-xs font-medium text-green-600">
                    {session.produtosList && session.produtosList.length > 0 ? formatCurrency(session.produtosList.filter(p => p.tipo === 'manual').reduce((total, p) => total + p.valorUnitario * p.quantidade, 0)) : session.valorTotalProduto || 'R$ 0,00'}
                  </span>)}

                {renderCell('additionalValue', renderEditableInput(session, 'valorAdicional', session.valorAdicional || 'R$ 0,00', 'text', 'R$ 0,00'))}

                {renderCell('details', renderEditableInput(session, 'observacoes', session.observacoes || '', 'text', 'Observações...'))}

                {renderCell('total', <span className="font-bold text-blue-700 text-xs">{formatCurrency(calculateTotal(session))}</span>)}

                {renderCell('paid', <span className="font-bold text-green-600 text-xs">{session.valorPago || 'R$ 0,00'}</span>)}

                {renderCell('remaining', (() => {
                  const restante = calculateRestante(session);
                  const paymentInfo = getPaymentPlanInfo(session.id);
                  return <div className="flex items-center gap-1">
                      <span className="font-bold text-orange-600 text-xs">{formatCurrency(restante)}</span>
                      {restante > 0 && paymentInfo.hasScheduled && <div className="flex items-center gap-1">
                          <div title="Tem pagamentos agendados">
                            <Calendar className="h-3 w-3 text-yellow-500" />
                          </div>
                          {paymentInfo.hasInstallments && <div title="Parcelado">
                              <CreditCard className="h-3 w-3 text-blue-500" />
                            </div>}
                        </div>}
                      {restante === 0 && <div title="Totalmente pago">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        </div>}
                    </div>;
                })())}

                {renderCell('payment', (() => {
                  const paymentInfo = getPaymentPlanInfo(session.id);
                  return <div className="flex flex-col gap-1 w-full">
                      {/* Linha principal: Input + Botões */}
                      <div className="flex items-center gap-1">
                        <Input type="number" placeholder="0,00" value={paymentInputs[session.id] || ''} onChange={e => setPaymentInputs(prev => ({
                        ...prev,
                        [session.id]: e.target.value
                      }))} onKeyDown={e => handlePaymentKeyDown(e, session.id)} className="h-6 text-xs p-1 flex-1 border-none bg-transparent focus:bg-lunar-accent/10 transition-colors duration-150 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" autoComplete="off" />
                        <Button variant="ghost" size="sm" onClick={() => handlePaymentAdd(session.id)} className="h-6 w-6 p-0 shrink-0">
                          <span className="text-xs font-bold">+</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                        setSelectedSessionForPayment(session);
                        setWorkflowPaymentsOpen(true);
                      }} className="h-6 w-6 p-0 shrink-0 hover:bg-primary/10 text-primary" title={paymentInfo?.hasScheduled ? "Editar Agendamento" : "Agendar Pagamento"}>
                          <CreditCard className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Status do agendamento */}
                      {paymentInfo?.hasScheduled && <div className="flex items-center gap-1 mt-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-4 bg-green-100 text-green-700 border-green-200">
                            <CheckCircle className="h-2.5 w-2.5 mr-1" />
                            Agendado
                          </Badge>
                        </div>}
                    </div>;
                })())}
                </tr>
               </>;
          })}
          </tbody>
        </table>
      </div>

      {/* Navigation Buttons with Tailwind's built-in pulse animation */}
      {maxScroll > 0 && <div className="fixed bottom-20 md:bottom-8 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-6">
          <Button variant="ghost" size="icon" onMouseDown={() => startContinuousScroll('left')} onMouseUp={stopContinuousScroll} onMouseLeave={stopContinuousScroll} onTouchStart={() => startContinuousScroll('left')} onTouchEnd={stopContinuousScroll} disabled={scrollPercent <= 1} className={`h-12 w-12 rounded-full bg-lunar-surface/60 backdrop-blur-sm shadow-lg border border-lunar-border/50 hover:bg-lunar-surface/80 transition-all duration-300 ease-out hover:scale-110 active:scale-95 disabled:opacity-30 ${scrollPercent <= 1 ? '' : 'animate-pulse'}`}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" onMouseDown={() => startContinuousScroll('right')} onMouseUp={stopContinuousScroll} onMouseLeave={stopContinuousScroll} onTouchStart={() => startContinuousScroll('right')} onTouchEnd={stopContinuousScroll} disabled={scrollPercent >= 99} className={`h-12 w-12 rounded-full bg-lunar-surface/60 backdrop-blur-sm shadow-lg border border-lunar-border/50 hover:bg-lunar-surface/80 transition-all duration-300 ease-out hover:scale-110 active:scale-95 disabled:opacity-30 ${scrollPercent >= 99 ? '' : 'animate-pulse'}`}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>}
        
        {/* Modal de Gerenciamento de Produtos */}
        {sessionSelecionada && <GerenciarProdutosModal open={modalAberto} onOpenChange={setModalAberto} sessionId={sessionSelecionada.id} clienteName={sessionSelecionada.nome} produtos={sessionSelecionada.produtosList || []} productOptions={productOptions} onSave={novosProdutos => {
      console.log('💾 Modal salvando produtos:', novosProdutos);
      
      // Garantir que produtos inclusos sempre tenham valor 0
      const produtosCorrigidos = novosProdutos.map(p => ({
        ...p,
        valorUnitario: p.tipo === 'incluso' ? 0 : p.valorUnitario
      }));
      
      console.log('💾 Produtos corrigidos:', produtosCorrigidos);
      
      // Atualizar a lista de produtos e recalcular totais
      handleFieldUpdateStable(sessionSelecionada.id, 'produtosList', produtosCorrigidos);

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

        {/* Modal de Pagamentos do Workflow */}
        {selectedSessionForPayment && <WorkflowPaymentsModal isOpen={workflowPaymentsOpen} onClose={() => {
      setWorkflowPaymentsOpen(false);
      setSelectedSessionForPayment(null);
    }} sessionData={selectedSessionForPayment} valorTotalCalculado={calculateTotal(selectedSessionForPayment)} onPaymentUpdate={(sessionId, totalPaid, fullPaymentsArray) => {
      // Atualizar contexto com novos pagamentos
      handleFieldUpdateStable(sessionId, 'valorPago', `R$ ${totalPaid.toFixed(2).replace('.', ',')}`);
      if (fullPaymentsArray) {
        handleFieldUpdateStable(sessionId, 'pagamentos', fullPaymentsArray);
      }
    }} />}

    {/* Modal de Exclusão Flexível */}
    {sessionToDelete && (
      <FlexibleDeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSessionToDelete(null);
        }}
        onConfirm={(includePayments) => {
          if (onDeleteSession && sessionToDelete) {
            onDeleteSession(sessionToDelete.id, sessionToDelete.title, sessionToDelete.paymentCount);
          }
        }}
        sessionTitle={sessionToDelete.title}
        paymentCount={sessionToDelete.paymentCount}
      />
    )}
    </div>;
}