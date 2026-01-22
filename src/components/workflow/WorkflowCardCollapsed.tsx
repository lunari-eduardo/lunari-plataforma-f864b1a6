import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkflowPackageCombobox } from "./WorkflowPackageCombobox";
import { ColoredStatusBadge } from "./ColoredStatusBadge";
import { GerenciarProdutosModal } from "./GerenciarProdutosModal";
import { WorkflowPaymentsModal } from "./WorkflowPaymentsModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, ChevronDown, ChevronUp, Package, Plus, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { formatToDayMonth } from "@/utils/dateUtils";
import { useAppContext } from "@/contexts/AppContext";
import debounce from 'lodash.debounce';
import type { SessionData } from "@/types/workflow";

interface WorkflowCardCollapsedProps {
  session: SessionData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  statusOptions: string[];
  packageOptions: any[];
  productOptions: any[];
  onStatusChange: (id: string, newStatus: string) => void;
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
  onDeleteSession?: (id: string, sessionTitle: string, paymentCount: number) => void;
}

// Input de fotos extras memoizado (mesma lógica do WorkflowTable)
const ExtraPhotoQtyInput = React.memo(({ 
  sessionId, 
  initialValue, 
  onUpdate 
}: {
  sessionId: string;
  initialValue: number;
  onUpdate: (sessionId: string, field: string, value: any, silent?: boolean) => void;
}) => {
  const [localValue, setLocalValue] = useState(String(initialValue || ''));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialValueRef = useRef(initialValue);
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current && initialValue !== initialValueRef.current) {
      setLocalValue(String(initialValue || ''));
      initialValueRef.current = initialValue;
      setHasUnsavedChanges(false);
    }
  }, [initialValue, sessionId]);

  const debouncedSave = useMemo(() => debounce((qtd: number) => {
    onUpdate(sessionId, 'qtdFotosExtra', qtd);
    initialValueRef.current = qtd;
    setHasUnsavedChanges(false);
    isEditingRef.current = false;
  }, 800), [sessionId, onUpdate]);

  useEffect(() => {
    return () => debouncedSave.cancel();
  }, [debouncedSave]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    isEditingRef.current = true;
    setLocalValue(value);
    setHasUnsavedChanges(true);
    debouncedSave(parseInt(value) || 0);
  };

  const handleBlur = () => {
    if (hasUnsavedChanges) {
      debouncedSave.cancel();
      const qtd = parseInt(localValue) || 0;
      onUpdate(sessionId, 'qtdFotosExtra', qtd);
      initialValueRef.current = qtd;
      setHasUnsavedChanges(false);
    }
    isEditingRef.current = false;
  };

  return (
    <Input 
      type="number" 
      value={localValue} 
      onChange={handleChange}
      onBlur={handleBlur}
      className={`h-7 text-xs p-1 w-14 text-center border border-border/50 rounded bg-background/50 focus:bg-background transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${hasUnsavedChanges ? 'bg-yellow-50' : ''}`}
      placeholder="0"
      autoComplete="off"
    />
  );
});
ExtraPhotoQtyInput.displayName = 'ExtraPhotoQtyInput';

export function WorkflowCardCollapsed({
  session,
  isExpanded,
  onToggleExpand,
  statusOptions,
  packageOptions,
  productOptions,
  onStatusChange,
  onFieldUpdate,
}: WorkflowCardCollapsedProps) {
  const { addPayment } = useAppContext();
  
  const [paymentInput, setPaymentInput] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [workflowPaymentsOpen, setWorkflowPaymentsOpen] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(session.descricao || '');
  
  // Sync description when session changes
  useEffect(() => {
    setDescriptionValue(session.descricao || '');
  }, [session.descricao]);

  const formatCurrency = useCallback((value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }, []);

  // Calcular valor pendente (mesma lógica do WorkflowTable)
  const calculateRestante = useCallback(() => {
    const valorPacoteStr = typeof session.valorPacote === 'string' ? session.valorPacote : String(session.valorPacote || '0');
    const valorPacote = parseFloat(valorPacoteStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const valorFotoExtraStr = typeof session.valorTotalFotoExtra === 'string' ? session.valorTotalFotoExtra : String(session.valorTotalFotoExtra || '0');
    const valorFotoExtra = parseFloat(valorFotoExtraStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const valorAdicionalStr = typeof session.valorAdicional === 'string' ? session.valorAdicional : String(session.valorAdicional || '0');
    const valorAdicional = parseFloat(valorAdicionalStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const desconto = parseFloat(String(session.desconto || 0).replace(/[^\d,]/g, '').replace(',', '.')) || 0;

    let valorProdutosManuais = 0;
    if (session.produtosList && session.produtosList.length > 0) {
      const produtosManuais = session.produtosList.filter(p => p.tipo === 'manual');
      valorProdutosManuais = produtosManuais.reduce((total, p) => {
        const valorUnit = parseFloat(String(p.valorUnitario || 0)) || 0;
        const quantidade = parseFloat(String(p.quantidade || 0)) || 0;
        return total + valorUnit * quantidade;
      }, 0);
    }

    const total = valorPacote + valorFotoExtra + valorProdutosManuais + valorAdicional - desconto;
    
    const valorPagoStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
    const valorPago = parseFloat(valorPagoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    return Math.max(0, total - valorPago);
  }, [session]);

  const handlePaymentAdd = useCallback(async () => {
    if (paymentInput && !isNaN(parseFloat(paymentInput))) {
      const paymentValue = parseFloat(paymentInput);
      try {
        await addPayment(session.id, paymentValue);
        setPaymentInput('');
      } catch (error) {
        console.error('❌ Erro ao adicionar pagamento:', error);
      }
    }
  }, [paymentInput, addPayment, session.id]);

  const handlePaymentKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePaymentAdd();
    }
  }, [handlePaymentAdd]);

  const handleDescriptionBlur = useCallback(() => {
    if (descriptionValue !== session.descricao) {
      onFieldUpdate(session.id, 'descricao', descriptionValue);
    }
  }, [descriptionValue, session.descricao, session.id, onFieldUpdate]);

  const handleStatusChange = useCallback((newStatus: string) => {
    const statusValue = newStatus === '__CLEAR__' ? '' : newStatus;
    onStatusChange(session.id, statusValue);
  }, [session.id, onStatusChange]);

  const pendente = calculateRestante();
  const hasProdutos = session.produtosList && session.produtosList.length > 0;
  const produtosProduzidos = hasProdutos ? session.produtosList.filter(p => p.produzido) : [];
  const todosCompletos = hasProdutos && produtosProduzidos.length === session.produtosList.length;
  const parcialmenteCompletos = hasProdutos && produtosProduzidos.length > 0 && produtosProduzidos.length < session.produtosList.length;

  // Obter nome do pacote das regras congeladas ou do pacote atual
  const displayPackageName = session.regras_congeladas?.pacote?.nome || session.pacote || '';

  return (
    <div className="p-3 md:p-4">
      {/* Layout horizontal em linha única */}
      <div className="flex items-center gap-2 md:gap-3 flex-wrap lg:flex-nowrap">
        
        {/* Botão Expand */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
          className="h-8 w-8 p-0 shrink-0 hover:bg-primary/10"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-primary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {/* Data */}
        <div className="shrink-0 w-12 md:w-14 text-sm font-medium text-foreground">
          {formatToDayMonth(session.data)}
        </div>

        {/* Nome + WhatsApp */}
        <div className="flex items-center gap-1 min-w-[100px] max-w-[160px] md:max-w-[200px]">
          {session.clienteId ? (
            <Link 
              to={`/app/clientes/${session.clienteId}`} 
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate"
            >
              {session.nome}
            </Link>
          ) : (
            <span className="text-sm font-medium text-foreground truncate">{session.nome}</span>
          )}
          {session.whatsapp && (
            <a
              href={`https://wa.me/${session.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <MessageCircle className="h-3.5 w-3.5 text-green-600 hover:text-green-700" />
            </a>
          )}
        </div>

        {/* Descrição - editável inline */}
        <Input
          value={descriptionValue}
          onChange={(e) => setDescriptionValue(e.target.value)}
          onBlur={handleDescriptionBlur}
          placeholder="Descrição..."
          className="h-7 text-xs flex-1 min-w-[80px] max-w-[150px] md:max-w-[200px] border border-border/50 rounded bg-background/50 focus:bg-background"
        />

        {/* Pacote - Dropdown */}
        <div className="shrink-0 w-[120px] md:w-[150px]">
          <WorkflowPackageCombobox
            key={`package-${session.id}-${session.pacote}`}
            value={session.pacote}
            displayName={displayPackageName}
            onValueChange={(packageData) => {
              onFieldUpdate(session.id, 'pacote', packageData.id || packageData.nome);
            }}
          />
        </div>

        {/* Status - Dropdown */}
        <div className="shrink-0 w-[110px] md:w-[130px]">
          <Select
            value={session.status || ''}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className="h-7 text-xs border border-border/50 rounded bg-background/50">
              <SelectValue placeholder="Status">
                {session.status && (
                  <ColoredStatusBadge status={session.status} />
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border shadow-lg z-50">
              <SelectItem value="__CLEAR__" className="text-muted-foreground italic">
                Limpar status
              </SelectItem>
              {statusOptions.map(status => (
                <SelectItem key={status} value={status}>
                  <ColoredStatusBadge status={status} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fotos Extras - input numérico */}
        <div className="shrink-0 flex items-center gap-1">
          <span className="text-xs text-muted-foreground hidden md:inline">Fotos:</span>
          <ExtraPhotoQtyInput
            sessionId={session.id}
            initialValue={session.qtdFotosExtra || 0}
            onUpdate={onFieldUpdate}
          />
        </div>

        {/* Produtos - botão com indicador */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setModalAberto(true)}
          className="h-7 px-2 text-xs shrink-0 hover:bg-primary/10"
        >
          <Package className={`h-3.5 w-3.5 mr-1 ${hasProdutos ? 'text-blue-600' : 'text-muted-foreground'}`} />
          {hasProdutos ? (
            <span className="text-blue-700 font-medium">{session.produtosList.length}</span>
          ) : (
            <Plus className="h-3 w-3 text-muted-foreground" />
          )}
          {todosCompletos && <div className="w-2 h-2 bg-green-500 rounded-full ml-1" />}
          {parcialmenteCompletos && <div className="w-2 h-2 bg-yellow-500 rounded-full ml-1" />}
        </Button>

        {/* PENDENTE - valor em vermelho */}
        <div className="shrink-0 flex items-center gap-1">
          <span className="text-xs text-muted-foreground hidden md:inline">Pendente:</span>
          <span className={`text-sm font-bold ${pendente > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(pendente)}
          </span>
        </div>

        {/* Input pagamento rápido */}
        <div className="shrink-0 flex items-center gap-1">
          <Input
            type="number"
            placeholder="0,00"
            value={paymentInput}
            onChange={(e) => setPaymentInput(e.target.value)}
            onKeyDown={handlePaymentKeyDown}
            className="h-7 text-xs p-1 w-16 md:w-20 border border-border/50 rounded bg-background/50 focus:bg-background [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            autoComplete="off"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePaymentAdd}
            className="h-7 w-7 p-0 shrink-0 hover:bg-green-100 text-green-600"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWorkflowPaymentsOpen(true)}
            className="h-7 w-7 p-0 shrink-0 hover:bg-primary/10 text-primary"
            title="Gerenciar pagamentos"
          >
            <CreditCard className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Modal de Gerenciamento de Produtos */}
      {modalAberto && (
        <GerenciarProdutosModal
          open={modalAberto}
          onOpenChange={setModalAberto}
          sessionId={session.id}
          clienteName={session.nome}
          produtos={session.produtosList || []}
          productOptions={productOptions}
          onSave={async (novosProdutos) => {
            const produtosCorrigidos = novosProdutos.map(p => ({
              ...p,
              valorUnitario: p.tipo === 'incluso' ? 0 : p.valorUnitario
            }));
            
            onFieldUpdate(session.id, 'produtosList', produtosCorrigidos);
            
            const produtosManuais = produtosCorrigidos.filter(p => p.tipo === 'manual');
            const valorTotalManuais = produtosManuais.reduce((total, p) => total + p.valorUnitario * p.quantidade, 0);
            
            if (produtosManuais.length > 0) {
              const nomesProdutos = produtosManuais.map(p => p.nome).join(', ');
              const nomesInclusos = produtosCorrigidos.filter(p => p.tipo === 'incluso').map(p => p.nome);
              const nomeCompleto = nomesInclusos.length > 0 
                ? `${nomesProdutos} + ${nomesInclusos.length} incluso(s)` 
                : nomesProdutos;
              onFieldUpdate(session.id, 'produto', nomeCompleto);
              onFieldUpdate(session.id, 'qtdProduto', produtosManuais.reduce((total, p) => total + p.quantidade, 0));
            } else if (produtosCorrigidos.filter(p => p.tipo === 'incluso').length > 0) {
              const produtosInclusos = produtosCorrigidos.filter(p => p.tipo === 'incluso');
              onFieldUpdate(session.id, 'produto', `${produtosInclusos.length} produto(s) incluso(s)`);
              onFieldUpdate(session.id, 'qtdProduto', 0);
            } else {
              onFieldUpdate(session.id, 'produto', '');
              onFieldUpdate(session.id, 'qtdProduto', 0);
            }
            
            await onFieldUpdate(session.id, 'valorTotalProduto', formatCurrency(valorTotalManuais), true);
          }}
        />
      )}

      {/* Modal de Pagamentos */}
      {workflowPaymentsOpen && (
        <WorkflowPaymentsModal
          isOpen={workflowPaymentsOpen}
          onClose={() => setWorkflowPaymentsOpen(false)}
          sessionData={session}
          valorTotalCalculado={pendente + parseFloat(String(session.valorPago || '0').replace(/[^\d,]/g, '').replace(',', '.')) || 0}
          onPaymentUpdate={(sessionId, totalPaid, fullPaymentsArray) => {
            onFieldUpdate(sessionId, 'valorPago', `R$ ${totalPaid.toFixed(2).replace('.', ',')}`);
            if (fullPaymentsArray) {
              onFieldUpdate(sessionId, 'pagamentos', fullPaymentsArray);
            }
          }}
        />
      )}
    </div>
  );
}
