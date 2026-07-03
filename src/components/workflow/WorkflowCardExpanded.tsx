import React, { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkflowPaymentsModal } from "./WorkflowPaymentsModal";
import { FotosExtrasPaymentBadge } from "./FotosExtrasPaymentBadge";
import { ChargeModal } from "@/components/cobranca/ChargeModal";
import { ExtraChargeModal } from "@/components/cobranca/ExtraChargeModal";
import { PaymentConfigModalExpanded } from "@/components/crm/PaymentConfigModalExpanded";
import { useSessionPayments } from "@/hooks/useSessionPayments";
import { useGalleryExtraCalc } from "@/hooks/useGalleryExtraCalc";
import { Lock } from "lucide-react";
import type { SessionData } from "@/types/workflow";
import { useAppContext } from "@/contexts/AppContext";
import { ExpandedFinancialFooter } from "./details/ExpandedFinancialFooter";
import { OverrideExtrasDialog } from "./details/OverrideExtrasDialog";
import { ExpandedActions } from "./details/ExpandedActions";

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
  onFieldUpdate,
}: WorkflowCardExpandedProps) {
  const { addPayment: addPaymentContext } = useAppContext();
  const [workflowPaymentsOpen, setWorkflowPaymentsOpen] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showExtraChargeModal, setShowExtraChargeModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentInput, setPaymentInput] = useState("");

  const [descontoValue, setDescontoValue] = useState(session.desconto || "");
  const [adicionalValue, setAdicionalValue] = useState(session.valorAdicional || "");
  const [obsValue, setObsValue] = useState(session.observacoes || "");
  const [valorFotoExtraValue, setValorFotoExtraValue] = useState(session.valorFotoExtra || "");
  const [qtdFotosExtraValue, setQtdFotosExtraValue] = useState(String(session.qtdFotosExtra || 0));

  const [pendingExtraEdit, setPendingExtraEdit] = useState<
    | { field: "valorFotoExtra"; nextValue: string; previousValue: string }
    | { field: "qtdFotosExtra"; nextValue: string; previousValue: string }
    | null
  >(null);

  const {
    addPayment: hookAddPayment,
    createInstallments,
    schedulePayment,
  } = useSessionPayments(session.id, session.pagamentos || []);

  useEffect(() => {
    setDescontoValue(session.desconto || "");
    setAdicionalValue(session.valorAdicional || "");
    setObsValue(session.observacoes || "");
    setValorFotoExtraValue(session.valorFotoExtra || "");
    setQtdFotosExtraValue(String(session.qtdFotosExtra || 0));
  }, [
    session.desconto,
    session.valorAdicional,
    session.observacoes,
    session.valorFotoExtra,
    session.qtdFotosExtra,
  ]);

  const formatCurrency = useCallback((value: any) => {
    return `R$ ${(Number(value) || 0).toFixed(2).replace(".", ",")}`;
  }, []);

  const parseCurrency = useCallback((value: string): number => {
    return parseFloat(value.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
  }, []);

  const valorPago = parseCurrency(String(session.valorPago || "0"));
  const total = parseCurrency(String(session.total || "0"));
  const pendente = Math.max(0, parseCurrency(String(session.restante || "0")));

  const handleDescontoBlur = useCallback(() => {
    const numValue = parseCurrency(descontoValue);
    const formatted = formatCurrency(numValue);
    setDescontoValue(formatted);
    onFieldUpdate(session.id, "desconto", formatted);
  }, [descontoValue, session.id, onFieldUpdate, parseCurrency, formatCurrency]);

  const handleEnterBlur = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  const handleAdicionalBlur = useCallback(() => {
    const numValue = parseCurrency(adicionalValue);
    const formatted = formatCurrency(numValue);
    setAdicionalValue(formatted);
    onFieldUpdate(session.id, "valorAdicional", formatted);
  }, [adicionalValue, session.id, onFieldUpdate, parseCurrency, formatCurrency]);

  const handleObsBlur = useCallback(() => {
    if (obsValue !== session.observacoes) {
      onFieldUpdate(session.id, "observacoes", obsValue);
    }
  }, [obsValue, session.observacoes, session.id, onFieldUpdate]);

  const paymentSubmittingRef = useRef(false);
  const handlePaymentAdd = useCallback(async () => {
    if (paymentSubmittingRef.current) return;
    const raw = paymentInput.trim();
    const value = parseFloat(raw.replace(",", "."));
    if (!raw || isNaN(value) || value <= 0) return;

    paymentSubmittingRef.current = true;
    setPaymentInput("");
    try {
      await addPaymentContext(session.id, value);
    } catch (error) {
      setPaymentInput(raw);
      console.error("❌ Erro ao adicionar pagamento:", error);
    } finally {
      paymentSubmittingRef.current = false;
    }
  }, [paymentInput, addPaymentContext, session.id]);

  const handlePaymentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (paymentSubmittingRef.current) return;
        handlePaymentAdd();
      }
    },
    [handlePaymentAdd],
  );

  const valorPacoteDisplay = formatCurrency(parseCurrency(String(session.valorPacote || "0")));

  // Snapshot canônico de fotos extras (RPC compartilhada com Gallery).
  // Fonte única quando a sessão está vinculada a uma galeria — evita divergência
  // entre workflow (qtd × valor local) e Gallery (RPC com regras congeladas +
  // ciclos anteriores). Handoff §5.1.
  const { calc: extraCalc, isLoading: extraCalcLoading } = useGalleryExtraCalc(
    session.galeriaId || null,
  );
  const hasGaleria = Boolean(session.galeriaId);
  const valorFotoExtraTotal = hasGaleria
    ? formatCurrency(extraCalc.valor_total_ideal)
    : formatCurrency(parseCurrency(String(session.valorTotalFotoExtra || "0")));
  const extrasPendente = hasGaleria
    ? Math.max(0, extraCalc.valor_a_cobrar)
    : 0;
  const extrasFullyPaid = hasGaleria ? extraCalc.is_fully_paid === true : true;

  let valorProdutosTotal = 0;
  if (session.produtosList && session.produtosList.length > 0) {
    valorProdutosTotal = session.produtosList
      .filter((p) => p.tipo === "manual")
      .reduce((total, p) => total + (p.valorUnitario || 0) * (p.quantidade || 0), 0);
  }

  const pacoteNome = session.regras_congeladas?.pacote?.nome || session.pacote || "Não definido";

  const handleValueFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  // Edição de fotos extras (sensível somente quando galeria tem vendas reais)
  const isLinkedToGallery = Boolean(session.galeriaId);
  const galeriaHasSales =
    isLinkedToGallery &&
    (session.galeriaStatusPagamento === "pago" ||
      Number((session as any).galerias?.valor_total_vendido ?? 0) > 0);

  const regrasPacote =
    (session as any)?.regras_congeladas?.pacote ??
    (session as any)?.regrasDePrecoFotoExtraCongeladas?.pacote;
  const precoBaseTabela = Number(regrasPacote?.valorFotoExtra ?? 0);
  const precoEfetivo = Number(regrasPacote?.valorFotoExtraEfetivo ?? precoBaseTabela);
  const hasDescontoProgressivo =
    precoBaseTabela > 0 &&
    precoEfetivo > 0 &&
    Math.abs(precoBaseTabela - precoEfetivo) > 0.01;

  const requestExtraEdit = useCallback(
    (field: "valorFotoExtra" | "qtdFotosExtra", nextValue: string, previousValue: string) => {
      if (nextValue === previousValue) return;
      if (galeriaHasSales) {
        setPendingExtraEdit({ field, nextValue, previousValue });
      } else {
        onFieldUpdate(session.id, field, nextValue);
      }
    },
    [galeriaHasSales, session.id, onFieldUpdate],
  );

  const handleValorFotoExtraBlur = useCallback(() => {
    const numValue = parseCurrency(valorFotoExtraValue);
    const formatted = formatCurrency(numValue);
    setValorFotoExtraValue(formatted);
    const previous = formatCurrency(parseCurrency(String(session.valorFotoExtra || "0")));
    requestExtraEdit("valorFotoExtra", formatted, previous);
  }, [valorFotoExtraValue, session.valorFotoExtra, requestExtraEdit, parseCurrency, formatCurrency]);

  const handleQtdFotosExtraBlur = useCallback(() => {
    const sanitized = String(Math.max(0, parseInt(qtdFotosExtraValue, 10) || 0));
    setQtdFotosExtraValue(sanitized);
    requestExtraEdit("qtdFotosExtra", sanitized, String(session.qtdFotosExtra || 0));
  }, [qtdFotosExtraValue, session.qtdFotosExtra, requestExtraEdit]);

  const confirmExtraEdit = useCallback(() => {
    if (!pendingExtraEdit) return;
    onFieldUpdate(session.id, pendingExtraEdit.field, pendingExtraEdit.nextValue);
    setPendingExtraEdit(null);
  }, [pendingExtraEdit, session.id, onFieldUpdate]);

  const cancelExtraEdit = useCallback(() => {
    if (pendingExtraEdit?.field === "valorFotoExtra") {
      setValorFotoExtraValue(pendingExtraEdit.previousValue);
    } else if (pendingExtraEdit?.field === "qtdFotosExtra") {
      setQtdFotosExtraValue(pendingExtraEdit.previousValue);
    }
    setPendingExtraEdit(null);
  }, [pendingExtraEdit]);

  return (
    <div className="bg-gradient-to-br from-transparent via-gray-50/10 to-stone-50/10 dark:from-transparent dark:via-[#1f1f1f]/30 dark:to-[#1a1a1a]/30 px-4 py-5 md:px-6">
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
                onKeyDown={handleEnterBlur}
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
                        <div>
                          Preço cobrado: <strong>{formatCurrency(precoEfetivo)}</strong>
                        </div>
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
                        Sincronizado com a galeria. Editar aqui sobrescreve o valor recebido do
                        Gallery.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
              <Input
                value={valorFotoExtraValue}
                onChange={(e) => setValorFotoExtraValue(e.target.value)}
                onBlur={handleValorFotoExtraBlur}
                onKeyDown={handleEnterBlur}
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
                        Sincronizado com a galeria. Editar aqui sobrescreve a quantidade vinda do
                        Gallery e recalcula o total automaticamente (útil para fotos vendidas por
                        fora).
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
                onKeyDown={handleEnterBlur}
                onFocus={handleValueFocus}
                placeholder="0"
                className="h-7 text-xs text-right w-24 border border-border/50 dark:border-border rounded bg-background/50 dark:bg-background/80"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total fotos extras:</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {hasGaleria && extraCalcLoading ? "…" : valorFotoExtraTotal}
                </span>
                <FotosExtrasPaymentBadge
                  status={
                    hasGaleria
                      ? extrasFullyPaid
                        ? "pago"
                        : extrasPendente > 0
                          ? "pendente"
                          : session.galeriaStatusPagamento
                      : session.galeriaStatusPagamento
                  }
                />
                {session.extrasOverridden && isLinkedToGallery && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onFieldUpdate(session.id, "resyncExtrasWithGallery", true)}
                          className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[9px] font-semibold border border-amber-200 dark:border-amber-500/30 hover:bg-amber-200/70 dark:hover:bg-amber-950/60 transition-colors"
                        >
                          Manual
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Valores foram editados manualmente e não estão sincronizando com a galeria.
                        Clique para re-sincronizar com os dados do Gallery.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {hasGaleria && extrasPendente > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground/80">Pendente extras:</span>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {formatCurrency(extrasPendente)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total produtos:</span>
              <span className="text-sm font-medium text-foreground">
                {formatCurrency(valorProdutosTotal)}
              </span>
            </div>

            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground">Adicional:</span>
              <Input
                value={adicionalValue}
                onChange={(e) => setAdicionalValue(e.target.value)}
                onBlur={handleAdicionalBlur}
                onKeyDown={handleEnterBlur}
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
        <ExpandedActions
          session={session}
          onCobrar={() => setShowChargeModal(true)}
          onAgendarPagamento={() => setShowAddPaymentModal(true)}
          onAbrirPagamentos={() => setWorkflowPaymentsOpen(true)}
        />
      </div>

      <ExpandedFinancialFooter
        total={total}
        valorPago={valorPago}
        pendente={pendente}
        paymentInput={paymentInput}
        setPaymentInput={setPaymentInput}
        onPaymentAdd={handlePaymentAdd}
        onPaymentKeyDown={handlePaymentKeyDown}
        formatCurrency={formatCurrency}
      />

      {workflowPaymentsOpen && (
        <WorkflowPaymentsModal
          isOpen={workflowPaymentsOpen}
          onClose={() => {
            setWorkflowPaymentsOpen(false);
            window.dispatchEvent(
              new CustomEvent("payment-created", {
                detail: { sessionId: session.sessionId || session.id },
              }),
            );
          }}
          sessionData={session}
          valorTotalCalculado={total}
          onPaymentUpdate={() => {}}
        />
      )}

      <ChargeModal
        isOpen={showChargeModal}
        onClose={() => setShowChargeModal(false)}
        clienteId={session.clienteId || ""}
        clienteNome={session.nome || "Cliente"}
        clienteWhatsapp={session.whatsapp}
        sessionId={session.sessionId || session.id}
        valorSugerido={pendente}
      />

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

      <OverrideExtrasDialog
        pendingExtraEdit={pendingExtraEdit}
        onConfirm={confirmExtraEdit}
        onCancel={cancelExtraEdit}
      />
    </div>
  );
}
