import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkflowPaymentsModal } from "./WorkflowPaymentsModal";

import { ColoredStatusBadge } from "./ColoredStatusBadge";

import { FotosExtrasPaymentBadge } from "./FotosExtrasPaymentBadge";
import { ChargeModal } from "@/components/cobranca/ChargeModal";
import { PaymentConfigModalExpanded } from "@/components/crm/PaymentConfigModalExpanded";
import { useSessionPayments } from "@/hooks/useSessionPayments";
import { CreditCard, Plus, Send, AlertTriangle, Lock } from "lucide-react";
import type { SessionData } from "@/types/workflow";
import { useAppContext } from "@/contexts/AppContext";
import { SessaoContratoButton } from "@/components/contratos/SessaoContratoButton";

interface WorkflowCardExpandedProps {
  session: SessionData;
  packageOptions: any[];
  productOptions: any[];
  statusOptions?: string[];
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export function WorkflowCardExpanded({
  session,
  packageOptions,
  productOptions,
  statusOptions = [],
  onFieldUpdate,
  onStatusChange,
}: WorkflowCardExpandedProps) {
  const { addPayment: addPaymentContext } = useAppContext();
  const [workflowPaymentsOpen, setWorkflowPaymentsOpen] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentInput, setPaymentInput] = useState('');
  
  const [descriptionValue, setDescriptionValue] = useState(session.descricao || '');
  
  // Estados locais para edição inline
  const [descontoValue, setDescontoValue] = useState(session.desconto || '');
  const [adicionalValue, setAdicionalValue] = useState(session.valorAdicional || '');
  const [obsValue, setObsValue] = useState(session.observacoes || '');
  const [valorFotoExtraValue, setValorFotoExtraValue] = useState(session.valorFotoExtra || '');
  const [qtdFotosExtraValue, setQtdFotosExtraValue] = useState(String(session.qtdFotosExtra || 0));

  // Confirmação para edição de campos vinculados à galeria
  const [pendingExtraEdit, setPendingExtraEdit] = useState<
    | { field: 'valorFotoExtra'; nextValue: string; previousValue: string }
    | { field: 'qtdFotosExtra'; nextValue: string; previousValue: string }
    | null
  >(null);

  // Hook de pagamentos para os modais
  const {
    payments: sessionPayments,
    totalPago: hookTotalPago,
    addPayment: hookAddPayment,
    createInstallments,
    schedulePayment,
  } = useSessionPayments(session.id, session.pagamentos || []);

  // Sync quando session muda
  useEffect(() => {
    setDescontoValue(session.desconto || '');
    setAdicionalValue(session.valorAdicional || '');
    setObsValue(session.observacoes || '');
    setDescriptionValue(session.descricao || '');
    setValorFotoExtraValue(session.valorFotoExtra || '');
    setQtdFotosExtraValue(String(session.qtdFotosExtra || 0));
  }, [session.desconto, session.valorAdicional, session.observacoes, session.descricao, session.valorFotoExtra, session.qtdFotosExtra]);

  const formatCurrency = useCallback((value: any) => {
    return `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;
  }, []);

  const parseCurrency = useCallback((value: string): number => {
    return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  }, []);

  // Cálculos financeiros (mesma lógica do WorkflowTable)
  const calculateTotal = useCallback(() => {
    const valorPacote = parseCurrency(String(session.valorPacote || '0'));
    const valorFotoExtra = parseCurrency(String(session.valorTotalFotoExtra || '0'));
    const valorAdicional = parseCurrency(String(session.valorAdicional || '0'));
    const desconto = parseCurrency(String(session.desconto || '0'));

    let valorProdutosManuais = 0;
    if (session.produtosList && session.produtosList.length > 0) {
      const produtosManuais = session.produtosList.filter(p => p.tipo === 'manual');
      valorProdutosManuais = produtosManuais.reduce((total, p) => {
        return total + (parseFloat(String(p.valorUnitario || 0)) || 0) * (parseFloat(String(p.quantidade || 0)) || 0);
      }, 0);
    }

    return Math.max(0, valorPacote + valorFotoExtra + valorProdutosManuais + valorAdicional - desconto);
  }, [session, parseCurrency]);

  const valorPago = parseCurrency(String(session.valorPago || '0'));
  const total = calculateTotal();
  const pendente = Math.max(0, total - valorPago);

  // Handlers para campos editáveis
  const handleDescontoBlur = useCallback(() => {
    const numValue = parseCurrency(descontoValue);
    const formatted = formatCurrency(numValue);
    setDescontoValue(formatted);
    onFieldUpdate(session.id, 'desconto', formatted);
  }, [descontoValue, session.id, onFieldUpdate, parseCurrency, formatCurrency]);

  const handleDescontoKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  const handleAdicionalBlur = useCallback(() => {
    const numValue = parseCurrency(adicionalValue);
    const formatted = formatCurrency(numValue);
    setAdicionalValue(formatted);
    onFieldUpdate(session.id, 'valorAdicional', formatted);
  }, [adicionalValue, session.id, onFieldUpdate, parseCurrency, formatCurrency]);

  const handleAdicionalKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  const handleObsBlur = useCallback(() => {
    if (obsValue !== session.observacoes) {
      onFieldUpdate(session.id, 'observacoes', obsValue);
    }
  }, [obsValue, session.observacoes, session.id, onFieldUpdate]);

  // Handler pagamento rápido (com proteção contra Enter duplo)
  const paymentSubmittingRef = useRef(false);
  const handlePaymentAdd = useCallback(async () => {
    if (paymentSubmittingRef.current) return;
    const raw = paymentInput.trim();
    const value = parseFloat(raw.replace(',', '.'));
    if (!raw || isNaN(value) || value <= 0) return;

    paymentSubmittingRef.current = true;
    setPaymentInput('');
    try {
      await addPaymentContext(session.id, value);
    } catch (error) {
      setPaymentInput(raw);
      console.error('❌ Erro ao adicionar pagamento:', error);
    } finally {
      paymentSubmittingRef.current = false;
    }
  }, [paymentInput, addPaymentContext, session.id]);

  const handlePaymentKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (paymentSubmittingRef.current) return;
      handlePaymentAdd();
    }
  }, [handlePaymentAdd]);


  // Dados para exibição
  const valorPacoteDisplay = formatCurrency(parseCurrency(String(session.valorPacote || '0')));
  const valorFotoExtraUnit = formatCurrency(parseCurrency(String(session.valorFotoExtra || '0')));
  const valorFotoExtraTotal = formatCurrency(parseCurrency(String(session.valorTotalFotoExtra || '0')));
  
  let valorProdutosTotal = 0;
  if (session.produtosList && session.produtosList.length > 0) {
    valorProdutosTotal = session.produtosList
      .filter(p => p.tipo === 'manual')
      .reduce((total, p) => total + (p.valorUnitario || 0) * (p.quantidade || 0), 0);
  }

  const pacoteNome = session.regras_congeladas?.pacote?.nome || session.pacote || 'Não definido';
  const displayPackageName = session.regras_congeladas?.pacote?.nome || session.pacote || '';
  const hasProdutos = session.produtosList && session.produtosList.length > 0;

  const handleStatusChange = useCallback((newStatus: string) => {
    const statusValue = newStatus === '__CLEAR__' ? '' : newStatus;
    if (onStatusChange) {
      onStatusChange(session.id, statusValue);
    }
  }, [session.id, onStatusChange]);

  const handleDescriptionBlur = useCallback(() => {
    if (descriptionValue !== session.descricao) {
      onFieldUpdate(session.id, 'descricao', descriptionValue);
    }
  }, [descriptionValue, session.descricao, session.id, onFieldUpdate]);

  // Handler para selecionar todo texto ao focar nos inputs de valor
  const handleValueFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  // === Edição de fotos extras (sensível somente quando galeria tem vendas reais) ===
  const isLinkedToGallery = Boolean(session.galeriaId);
  // Galeria com vendas consolidadas → travar (cadeado + modal de confirmação).
  // Galeria vinculada mas sem vendas → edição livre (caso "vendi fotos por fora").
  const galeriaHasSales =
    isLinkedToGallery && (
      session.galeriaStatusPagamento === 'pago' ||
      Number((session as any).galerias?.valor_total_vendido ?? 0) > 0
    );

  const hasGalleryDivergenceWarning = galeriaHasSales && (
    session.galeriaStatusPagamento === 'pago' || session.galeriaStatusPagamento === 'pendente'
  );

  // === Detecção de desconto progressivo aplicado pela galeria ===
  const regrasPacote = (session as any)?.regras_congeladas?.pacote
    ?? (session as any)?.regrasDePrecoFotoExtraCongeladas?.pacote;
  const precoBaseTabela = Number(regrasPacote?.valorFotoExtra ?? 0);
  const precoEfetivo = Number(regrasPacote?.valorFotoExtraEfetivo ?? precoBaseTabela);
  const hasDescontoProgressivo = precoBaseTabela > 0
    && precoEfetivo > 0
    && Math.abs(precoBaseTabela - precoEfetivo) > 0.01;

  const requestExtraEdit = useCallback((field: 'valorFotoExtra' | 'qtdFotosExtra', nextValue: string, previousValue: string) => {
    if (nextValue === previousValue) return;
    if (galeriaHasSales) {
      setPendingExtraEdit({ field, nextValue, previousValue });
    } else {
      onFieldUpdate(session.id, field, nextValue);
    }
  }, [galeriaHasSales, session.id, onFieldUpdate]);

  const handleValorFotoExtraBlur = useCallback(() => {
    const numValue = parseCurrency(valorFotoExtraValue);
    const formatted = formatCurrency(numValue);
    setValorFotoExtraValue(formatted);
    const previous = formatCurrency(parseCurrency(String(session.valorFotoExtra || '0')));
    requestExtraEdit('valorFotoExtra', formatted, previous);
  }, [valorFotoExtraValue, session.valorFotoExtra, requestExtraEdit, parseCurrency, formatCurrency]);

  const handleQtdFotosExtraBlur = useCallback(() => {
    const sanitized = String(Math.max(0, parseInt(qtdFotosExtraValue, 10) || 0));
    setQtdFotosExtraValue(sanitized);
    requestExtraEdit('qtdFotosExtra', sanitized, String(session.qtdFotosExtra || 0));
  }, [qtdFotosExtraValue, session.qtdFotosExtra, requestExtraEdit]);

  const handleExtraEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  const confirmExtraEdit = useCallback(() => {
    if (!pendingExtraEdit) return;
    onFieldUpdate(session.id, pendingExtraEdit.field, pendingExtraEdit.nextValue);
    setPendingExtraEdit(null);
  }, [pendingExtraEdit, session.id, onFieldUpdate]);

  const cancelExtraEdit = useCallback(() => {
    if (pendingExtraEdit?.field === 'valorFotoExtra') {
      setValorFotoExtraValue(pendingExtraEdit.previousValue);
    } else if (pendingExtraEdit?.field === 'qtdFotosExtra') {
      setQtdFotosExtraValue(pendingExtraEdit.previousValue);
    }
    setPendingExtraEdit(null);
  }, [pendingExtraEdit]);

  return (
    <div className="bg-gradient-to-br from-transparent via-gray-50/10 to-stone-50/10 dark:from-transparent dark:via-[#1f1f1f]/30 dark:to-[#1a1a1a]/30 px-4 py-5 md:px-6">
      {/* Grid de 3 blocos com divisórias */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* BLOCO 1 - Dados da Sessão */}
        <div className="space-y-3 border-r border-border/20 pr-6">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Dados da Sessão
          </h4>
          
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Pacote:</span>
              <span className="text-sm font-medium text-foreground">{pacoteNome}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Valor base:</span>
              <span className="text-sm font-medium text-primary">{valorPacoteDisplay}</span>
            </div>
            
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground">Desconto:</span>
              <Input
                value={descontoValue}
                onChange={(e) => setDescontoValue(e.target.value)}
                onBlur={handleDescontoBlur}
                onKeyDown={handleDescontoKeyDown}
                onFocus={handleValueFocus}
                placeholder="R$ 0,00"
                className="h-7 text-xs text-right w-24 border border-border/50 dark:border-border rounded bg-background/50 dark:bg-background/80"
              />
            </div>
            
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                Vlr foto extra:
                {hasDescontoProgressivo && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center h-4 px-1 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[9px] font-semibold cursor-help border border-emerald-200 dark:border-emerald-500/30">
                          %
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        <div className="font-semibold mb-1">Desconto progressivo aplicado</div>
                        <div>Preço de tabela: {formatCurrency(precoBaseTabela)}</div>
                        <div>Preço cobrado: <strong>{formatCurrency(precoEfetivo)}</strong></div>
                        <div className="mt-1 text-muted-foreground">
                          Faixa de quantidade aplicada na galeria.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {galeriaHasSales && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="h-3 w-3 text-muted-foreground/60" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Sincronizado com a galeria. Editar aqui sobrescreve o valor recebido do Gallery.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
              <Input
                value={valorFotoExtraValue}
                onChange={(e) => setValorFotoExtraValue(e.target.value)}
                onBlur={handleValorFotoExtraBlur}
                onKeyDown={handleExtraEditKeyDown}
                onFocus={handleValueFocus}
                placeholder="R$ 0,00"
                className="h-7 text-xs text-right w-24 border border-border/50 dark:border-border rounded bg-background/50 dark:bg-background/80"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 2 - Adicionais */}
        <div className="space-y-3 border-r border-border/20 pr-6">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Adicionais
          </h4>
          
          <div className="space-y-2.5">
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                Qtd fotos extras:
                {galeriaHasSales && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="h-3 w-3 text-muted-foreground/60" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Sincronizado com a galeria. Editar aqui sobrescreve a quantidade vinda do Gallery e recalcula o total automaticamente (útil para fotos vendidas por fora).
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
              <Input
                type="number"
                min={0}
                value={qtdFotosExtraValue}
                onChange={(e) => setQtdFotosExtraValue(e.target.value)}
                onBlur={handleQtdFotosExtraBlur}
                onKeyDown={handleExtraEditKeyDown}
                onFocus={handleValueFocus}
                placeholder="0"
                className="h-7 text-xs text-right w-24 border border-border/50 dark:border-border rounded bg-background/50 dark:bg-background/80"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total fotos extras:</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{valorFotoExtraTotal}</span>
                <FotosExtrasPaymentBadge status={session.galeriaStatusPagamento} />
                {session.extrasOverridden && isLinkedToGallery && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onFieldUpdate(session.id, 'resyncExtrasWithGallery', true)}
                          className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[9px] font-semibold border border-amber-200 dark:border-amber-500/30 hover:bg-amber-200/70 dark:hover:bg-amber-950/60 transition-colors"
                        >
                          Manual
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Valores foram editados manualmente e não estão sincronizando com a galeria. Clique para re-sincronizar com os dados do Gallery.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total produtos:</span>
              <span className="text-sm font-medium text-foreground">{formatCurrency(valorProdutosTotal)}</span>
            </div>
            
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground">Adicional:</span>
              <Input
                value={adicionalValue}
                onChange={(e) => setAdicionalValue(e.target.value)}
                onBlur={handleAdicionalBlur}
                onKeyDown={handleAdicionalKeyDown}
                onFocus={handleValueFocus}
                placeholder="R$ 0,00"
                className="h-7 text-xs text-right w-24 border border-border/50 dark:border-border rounded bg-background/50 dark:bg-background/80"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Obs:</span>
              <Textarea
                value={obsValue}
                onChange={(e) => setObsValue(e.target.value)}
                onBlur={handleObsBlur}
                placeholder="Observações..."
                className="text-xs min-h-[60px] border border-border/50 dark:border-border rounded bg-background/50 dark:bg-background/80 resize-none"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 3 - Ações */}
        <div className="space-y-3 flex flex-col items-center justify-center py-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Ações
          </h4>
          
          <div className="flex flex-col items-center gap-2 w-full max-w-[220px]">
            {/* Cobrar */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChargeModal(true)}
              className="gap-2 w-full border-primary text-primary hover:bg-primary/10"
            >
              <Send className="h-3.5 w-3.5" />
              Cobrar
            </Button>

            {/* Agendar pagamento manual */}
            <Button
              size="sm"
              onClick={() => setShowAddPaymentModal(true)}
              className="gap-2 w-full"
            >
              <Plus className="h-3.5 w-3.5" />
              Agendar pagamento manual
            </Button>

            {/* Divisor */}
            <div className="w-full border-t border-border/20 my-1" />

            {/* Pagamentos (modal completo) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWorkflowPaymentsOpen(true)}
              className="gap-2 w-full"
            >
              <CreditCard className="h-4 w-4" />
              Pagamentos
            </Button>

            {/* Contrato — ação documental, separada das ações de pagamento */}
            {session.clienteId && (
              <SessaoContratoButton
                sessionId={session.sessionId || session.id}
                clienteId={session.clienteId}
                clienteNome={session.nome}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer Financeiro com input de pagamento rápido */}
      <div className="mt-6 pt-4 border-t border-border/30 dark:border-border/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Resumo financeiro à esquerda */}
          <div className="flex items-center gap-6 md:gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
              <span className="text-lg font-bold text-blue-700">{formatCurrency(total)}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pago</span>
              <span className="text-lg font-bold text-green-600">{formatCurrency(valorPago)}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pendente</span>
              <span className={`text-lg font-bold ${pendente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(pendente)}
              </span>
            </div>
          </div>
          
          {/* Input pagamento rápido à direita */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden md:inline">Adic. Pag. Rápido</span>
            <div className="flex items-center border border-border/50 dark:border-border rounded-md bg-background/50 dark:bg-background/80">
              <span className="text-sm text-muted-foreground pl-2">R$</span>
              <Input
                type="number"
                placeholder="0,00"
                value={paymentInput}
                onChange={(e) => setPaymentInput(e.target.value)}
                onKeyDown={handlePaymentKeyDown}
                className="h-8 text-sm w-20 border-0 focus-visible:ring-0 bg-transparent [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoComplete="off"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePaymentAdd}
              className="h-8 w-8 p-0 hover:bg-green-50 hover:border-green-300 hover:text-green-600"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Pagamentos */}
      {workflowPaymentsOpen && (
        <WorkflowPaymentsModal
          isOpen={workflowPaymentsOpen}
          onClose={() => {
            setWorkflowPaymentsOpen(false);
            window.dispatchEvent(new CustomEvent('payment-created', {
              detail: { sessionId: session.sessionId || session.id }
            }));
          }}
          sessionData={session}
          valorTotalCalculado={total}
          onPaymentUpdate={() => {}}
        />
      )}

      {/* Charge Modal */}
      <ChargeModal
        isOpen={showChargeModal}
        onClose={() => setShowChargeModal(false)}
        clienteId={session.clienteId || ''}
        clienteNome={session.nome || 'Cliente'}
        clienteWhatsapp={session.whatsapp}
        sessionId={session.sessionId || session.id}
        valorSugerido={pendente}
      />

      {/* Payment Config Modal (Agendar pagamento manual) */}
      <PaymentConfigModalExpanded
        isOpen={showAddPaymentModal}
        onClose={() => setShowAddPaymentModal(false)}
        sessionId={session.id}
        clienteId={session.clienteId}
        valorTotal={total}
        valorJaPago={valorPago}
        valorRestante={pendente}
        clienteNome={session.nome}
        onAddPayment={hookAddPayment}
        onCreateInstallments={createInstallments}
        onSchedulePayment={schedulePayment}
      />

      {/* Confirmação de edição manual de fotos extras (sobrescreve sync da galeria) */}
      <AlertDialog open={pendingExtraEdit !== null} onOpenChange={(open) => { if (!open) cancelExtraEdit(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Sobrescrever dado da galeria?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Este campo é normalmente sincronizado automaticamente com a galeria
                desta sessão. Editar manualmente irá <strong>sobrescrever</strong> o
                valor recebido do Gallery e pode causar divergência financeira.
              </span>
              <span className="block">
                Novo valor:{" "}
                <strong className="text-foreground">
                  {pendingExtraEdit?.field === 'valorFotoExtra'
                    ? pendingExtraEdit?.nextValue
                    : `${pendingExtraEdit?.nextValue} foto(s)`}
                </strong>
              </span>
              <span className="block text-xs text-muted-foreground">
                Recomendado: corrija primeiro no Gallery — a sessão será sincronizada automaticamente.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelExtraEdit}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExtraEdit}>Sobrescrever mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
