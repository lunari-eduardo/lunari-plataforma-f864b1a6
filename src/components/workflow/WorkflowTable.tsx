import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import debounce from 'lodash.debounce';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { WorkflowPackageCombobox } from "./WorkflowPackageCombobox";
import { StatusBadge } from "./StatusBadge";
import { ColoredStatusBadge } from "./ColoredStatusBadge";
import { getContrastColor } from "@/lib/colorUtils";
import { GerenciarProdutosModal } from "./GerenciarProdutosModal";
import { WorkflowPaymentsModal } from "./WorkflowPaymentsModal";
import { FlexibleDeleteModal } from "./FlexibleDeleteModal";
import { AuditInfo } from "./AuditInfo";
import { QuickSessionAdd } from "./QuickSessionAdd";
import { WorkflowCardList } from "./WorkflowCardList";
import { MessageCircle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Package, Plus, CreditCard, Calendar, CheckCircle, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { GaleriaActions } from "@/components/galeria/GaleriaActions";
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
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { useWorkflowStatus } from '@/hooks/useWorkflowStatus';
import { usePricingMigration } from '@/hooks/usePricingMigration';

// ============================================================================
// COMPONENTE MEMOIZADO EXTRAÍDO - ExtraPhotoQtyInput
// Definido FORA do WorkflowTable para evitar re-criação a cada render
// ============================================================================
interface ExtraPhotoQtyInputProps {
  sessionId: string;
  initialValue: number;
  onUpdate: (sessionId: string, field: string, value: any, silent?: boolean) => void;
}

const ExtraPhotoQtyInput = React.memo(({ 
  sessionId, 
  initialValue, 
  onUpdate 
}: ExtraPhotoQtyInputProps) => {
  const [localValue, setLocalValue] = useState(String(initialValue || ''));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialValueRef = useRef(initialValue);
  const isEditingRef = useRef(false);

  // Sincronizar quando valor externo muda (mas NÃO durante edição ativa)
  useEffect(() => {
    if (!isEditingRef.current && initialValue !== initialValueRef.current) {
      console.log('📸 [ExtraPhotoQtyInput] Syncing external value:', initialValue, 'for session:', sessionId);
      setLocalValue(String(initialValue || ''));
      initialValueRef.current = initialValue;
      setHasUnsavedChanges(false);
    }
  }, [initialValue, sessionId]);

  // Debounced save function
  const debouncedSave = useMemo(() => debounce((qtd: number) => {
    console.log('📸 [ExtraPhotoQtyInput] Debounced save:', qtd, 'for session:', sessionId);
    onUpdate(sessionId, 'qtdFotosExtra', qtd);
    initialValueRef.current = qtd;
    setHasUnsavedChanges(false);
    isEditingRef.current = false;
  }, 800), [sessionId, onUpdate]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    isEditingRef.current = true;
    setLocalValue(value);
    setHasUnsavedChanges(true);
    
    const qtd = parseInt(value) || 0;
    debouncedSave(qtd);
  };

  const handleFocus = () => {
    isEditingRef.current = true;
    // Selecionar todo o texto ao focar
    setTimeout(() => {
      const input = document.activeElement as HTMLInputElement;
      if (input && input.select) {
        input.select();
      }
    }, 0);
  };

  const handleBlur = () => {
    if (hasUnsavedChanges) {
      debouncedSave.cancel();
      const qtd = parseInt(localValue) || 0;
      console.log('📸 [ExtraPhotoQtyInput] Blur save:', qtd, 'for session:', sessionId);
      onUpdate(sessionId, 'qtdFotosExtra', qtd);
      initialValueRef.current = qtd;
      setHasUnsavedChanges(false);
    }
    isEditingRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      debouncedSave.cancel();
      const qtd = parseInt(localValue) || 0;
      onUpdate(sessionId, 'qtdFotosExtra', qtd);
      initialValueRef.current = qtd;
      setHasUnsavedChanges(false);
      isEditingRef.current = false;
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <Input 
      type="number" 
      value={localValue} 
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`h-6 text-xs p-1 w-full border-none bg-transparent focus:bg-lunar-accent/10 transition-colors duration-150 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${hasUnsavedChanges ? 'bg-yellow-50' : ''}`}
      placeholder=""
      autoComplete="off"
    />
  );
});

ExtraPhotoQtyInput.displayName = 'ExtraPhotoQtyInput';
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
  galeria: 100,
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
  galeria: 80,
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
  galeria: 70,
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
  // CORREÇÃO: Usar real-time configuration (não mais useConfiguration)
  const {
    categorias
  } = useRealtimeConfiguration();
  const {
    getStatusColor
  } = useWorkflowStatus();
  const {
    executarMigracaoSeNecessario
  } = usePricingMigration();
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

  // FASE 4: Auto-sync temporarily removed to fix infinite loop
  // Will be reimplemented with debounce and loop protection in next phase

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
  const handlePaymentAdd = useCallback(async (sessionId: string) => {
    const value = paymentInputs[sessionId];
    if (value && !isNaN(parseFloat(value))) {
      const paymentValue = parseFloat(value);
      try {
        // Usar a função addPayment do contexto (agora async)
        await addPayment(sessionId, paymentValue);

        // Limpar o campo após adicionar
        setPaymentInputs(prev => ({
          ...prev,
          [sessionId]: ''
        }));

        // Nota: Não precisamos forçar re-render - o realtime do Supabase cuida disso
      } catch (error) {
        console.error('❌ Erro ao adicionar pagamento:', error);
      }
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

  // FASE 4: ResizeObserver para calcular maxScroll imediatamente após layout
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      // Recalcular maxScroll quando o container ou seu conteúdo redimensionar
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      setMaxScroll(maxScrollLeft);
      console.log('📐 [ResizeObserver] maxScroll recalculado:', maxScrollLeft);
    });

    observer.observe(container);
    
    // Também observar a tabela interna se existir
    const table = container.querySelector('table');
    if (table) {
      observer.observe(table);
    }

    return () => observer.disconnect();
  }, [sessions]);
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
      // ATOMIC UPDATE: Await field update before dependent calculations
      await handleFieldUpdateStable(sessionId, field, newValue);

      // Recalcular valor total das fotos extras quando o valor unitário for alterado
      if (field === 'valorFotoExtra') {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
          const valorUnit = parseFloat(newValue.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
          const qtd = session.qtdFotosExtra || 0;
          await handleFieldUpdateStable(sessionId, 'valorTotalFotoExtra', formatCurrency(qtd * valorUnit), true);
        }
      }

      // SISTEMA DE CONGELAMENTO: Recalcular quando quantidade de fotos extras for alterada
      if (field === 'qtdFotosExtra') {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
          const novaQuantidade = parseInt(newValue) || 0;

          // Importar e usar o AutoPhotoCalculator para recálculo
          const {
            pricingFreezingService
          } = await import('@/services/PricingFreezingService');
          if (session.regrasDePrecoFotoExtraCongeladas) {
            // Tentar usar regras congeladas se disponível
            try {
              const resultado = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(novaQuantidade, session.regrasDePrecoFotoExtraCongeladas as any);
              await handleFieldUpdateStable(sessionId, 'valorFotoExtra', formatCurrency(resultado.valorUnitario), true);
              await handleFieldUpdateStable(sessionId, 'valorTotalFotoExtra', formatCurrency(resultado.valorTotal), true);
            } catch (error) {
              console.warn('⚠️ Erro usando regras congeladas, usando valor fixo:', error);
              const valorUnit = calcularValorRealPorFoto(session);
              await handleFieldUpdateStable(sessionId, 'valorTotalFotoExtra', formatCurrency(novaQuantidade * valorUnit), true);
            }
          } else {
            // Usar valor atual fixo
            const valorUnit = calcularValorRealPorFoto(session);
            await handleFieldUpdateStable(sessionId, 'valorTotalFotoExtra', formatCurrency(novaQuantidade * valorUnit), true);
          }
        }
      }
      // FASE 1-3: NÃO enviar total explícito - deixar o backend calcular atomicamente
      // O backend (useWorkflowRealtime) irá recalcular automaticamente quando campos
      // que afetam o total forem alterados. Isso garante consistência total.
      setEditingValues(prev => {
        const updated = {
          ...prev
        };
        delete updated[key];
        return updated;
      });
    }
  }, [editingValues, sessions, handleFieldUpdateStable, calcularValorRealPorFoto, formatCurrency, calculateTotal]);
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
    // Handle the clear status sentinel value
    const statusValue = newStatus === '__CLEAR__' ? '' : newStatus;
    onStatusChange(sessionId, statusValue);
  }, [onStatusChange]);

  // Helper para obter cor do status
  const getStatusColorValue = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmado':
        return '#34C759';
      case 'a confirmar':
      case 'pendente':
        return '#F59E0B';
      case 'cancelado':
        return '#EF4444';
      default:
        // Buscar da configuração de workflow
        return getStatusColor(status);
    }
  }, [getStatusColor]);
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      // Mostrar ícone neutro para indicar que é ordenável
      return <ChevronUp className="h-3 w-3 opacity-30" />;
    }
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
  // Novo layout de cards horizontais colapsáveis
  return (
    <WorkflowCardList
      sessions={sessions}
      statusOptions={statusOptions}
      categoryOptions={categoryOptions}
      packageOptions={packageOptions}
      productOptions={productOptions}
      onStatusChange={onStatusChange}
      onEditSession={onEditSession}
      onAddPayment={onAddPayment}
      onDeleteSession={onDeleteSession}
      onFieldUpdate={onFieldUpdate}
    />
  );
}