import React, { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkflowPaymentsModal } from "./WorkflowPaymentsModal";
import { FotosExtrasPaymentBadge } from "./FotosExtrasPaymentBadge";
import { ChargeModal } from "@/components/cobranca/ChargeModal";
import { ExtraChargeModal } from "@/components/cobranca/ExtraChargeModal";
import { CombinedChargeModal } from "@/components/cobranca/CombinedChargeModal";
import { ManualPaymentModal } from "./ManualPaymentModal";

import { useGalleryExtraCalc } from "@/hooks/useGalleryExtraCalc";
import { Lock, Camera, Plus, Package, Zap, Calculator } from "lucide-react";
import type { SessionData } from "@/types/workflow";
import { useAppContext } from "@/contexts/AppContext";
import { ExpandedFinancialFooter } from "./details/ExpandedFinancialFooter";
import { OverrideExtrasDialog } from "./details/OverrideExtrasDialog";
import { ExpandedActions } from "./details/ExpandedActions";
import { SectionHeader } from "./details/SectionHeader";
import { FieldRow } from "./details/FieldRow";
import { ProdutosSummaryBlock } from "./details/ProdutosSummaryBlock";
import { INPUT_EDITABLE, VALUE_STRONG } from "./details/cardTokens";
import { computeProductNextAction } from "@/features/workflow/domain/productNextAction";
import { SessionCreditBadge } from "@/components/finance/SessionCreditBadge";
import { useSessionFinancialsWithExtras } from "@/features/workflow/hooks/useSessionFinancialsWithExtras";


interface WorkflowCardExpandedProps {
  session: SessionData;
  packageOptions: any[];
  productOptions: any[];
  statusOptions?: string[];
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
  onStatusChange?: (id: string, newStatus: string) => void;
  /** Abre o modal "Gerenciar Produtos" (instância única no CardCollapsedModals). */
  onOpenProdutos?: () => void;
}

export function WorkflowCardExpanded({
  session,
  onFieldUpdate,
  onOpenProdutos,
}: WorkflowCardExpandedProps) {
  const { addPayment: addPaymentContext } = useAppContext();
  const [workflowPaymentsOpen, setWorkflowPaymentsOpen] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showExtraChargeModal, setShowExtraChargeModal] = useState(false);
  /**
   * "Cobrar tudo" usa CombinedChargeModal quando há galeria + sessão com valores.
   * O `combinedIntent` torna a intenção do clique explícita para o modal.
   */
  const [showCombinedChargeModal, setShowCombinedChargeModal] = useState(false);
  const [combinedIntent, setCombinedIntent] = useState<
    "extras_only" | "sessao_e_extras"
  >("sessao_e_extras");
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  

  

  const [descontoValue, setDescontoValue] = useState(session.desconto || "");
  const [adicionalValue, setAdicionalValue] = useState(session.valorAdicional || "");
  const [obsValue, setObsValue] = useState(session.observacoes || "");
  const [valorFotoExtraValue, setValorFotoExtraValue] = useState(session.valorFotoExtra || "");
  const [qtdFotosExtraValue, setQtdFotosExtraValue] = useState(String(session.qtdFotosExtra || 0));

  const [pendingExtraEdit, setPendingExtraEdit] = useState<
    | {
        field: "valorFotoExtra" | "qtdFotosExtra";
        nextValue: string;
        previousValue: string;
        source: "gallery" | "frozen_rules";
      }
    | null
  >(null);

  // Snapshot canônico de fotos extras (RPC compartilhada com Gallery).
  const { calc: extraCalc, resolvedGalleryId, isLoading: extraCalcLoading } =
    useGalleryExtraCalc(session.galeriaId || null, {
      sessionId: session.sessionId || null,
    });

  const fin = useSessionFinancialsWithExtras(
    session.id,
    session.galeriaId || resolvedGalleryId || null,
    session.sessionId || null,
  );

  const hasGaleria = fin.hasGaleria || Boolean(resolvedGalleryId);

  useEffect(() => {
    setDescontoValue(session.desconto || "");
    setAdicionalValue(session.valorAdicional || "");
    setObsValue(session.observacoes || "");
    setValorFotoExtraValue(session.valorFotoExtra || "");
  }, [
    session.desconto,
    session.valorAdicional,
    session.observacoes,
    session.valorFotoExtra,
  ]);

  // Sincroniza a quantidade de fotos extras com a RPC ou dados da sessão
  useEffect(() => {
    if (session.extrasOverridden) return;
    const resolvedQtd = fin.qtdExtras > 0 ? fin.qtdExtras : (Number(session.qtdFotosExtra) || 0);
    setQtdFotosExtraValue(String(resolvedQtd));
  }, [fin.qtdExtras, session.extrasOverridden, session.qtdFotosExtra]);

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

  const valorPacoteDisplay = formatCurrency(parseCurrency(String(session.valorPacote || "0")));

  const fallbackExtrasTotal = (Number(session.qtdFotosExtra) || 0) * parseCurrency(String(session.valorFotoExtra || "0"));
  const extrasTotalCanonico = fin.extrasLiquido > 0 ? fin.extrasLiquido : fallbackExtrasTotal;
  const extrasPagoCanonico = fin.extrasPago;
  const extrasPendente = fin.extrasPend;
  const extrasFullyPaid = fin.extrasPend <= 0.001;
  const valorFotoExtraTotal = formatCurrency(extrasTotalCanonico);

  // Totais visuais vêm da RPC com fallback resiliente para o snapshot local da sessão.
  const valorTotalFallback = parseCurrency(String(session.total || "0"));
  const totalVisual = fin.totalVisual > 0 ? fin.totalVisual : valorTotalFallback;
  const valorPagoDisplay = fin.pagoTotal > 0 ? fin.pagoTotal : valorPago;
  const pendenteVisual = fin.totalVisual > 0 || fin.pagoTotal > 0 ? fin.pendenteTot : Math.max(0, valorTotalFallback - valorPago);
  const pendenteSessaoSugerido = fin.totalVisual > 0 ? fin.pendenteSess : pendenteVisual;

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
  const isLinkedToGallery = hasGaleria;
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
        setPendingExtraEdit({ field, nextValue, previousValue, source: "gallery" });
        return;
      }
      // Sem galeria consolidada: se existe regra congelada com desconto
      // progressivo E ainda não há override, confirma antes de desvincular.
      if (hasDescontoProgressivo && !session.extrasOverridden) {
        setPendingExtraEdit({ field, nextValue, previousValue, source: "frozen_rules" });
        return;
      }
      onFieldUpdate(session.id, field, nextValue);
    },
    [galeriaHasSales, hasDescontoProgressivo, session.extrasOverridden, session.id, onFieldUpdate],
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
    <div className="bg-transparent px-4 py-5 md:px-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-5">
        {/* BLOCO 1 — Dados da Sessão */}
        <div className="rounded-2xl border border-stone-200/70 dark:border-border/40 bg-card/40 dark:bg-card/20 p-4 sm:p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <SectionHeader
              icon={Calculator}
              title="DADOS DA SESSÃO"
              subtitle="Informações principais do atendimento."
            />
            <div className="mt-2">
              <FieldRow label="Pacote">
                <span className={VALUE_STRONG}>{pacoteNome}</span>
              </FieldRow>
              <FieldRow label="Valor base">
                <span className={VALUE_STRONG + " text-primary"}>{valorPacoteDisplay}</span>
              </FieldRow>
              <FieldRow label="Desconto">
                <Input
                  value={descontoValue}
                  onChange={(e) => setDescontoValue(e.target.value)}
                  onBlur={handleDescontoBlur}
                  onKeyDown={handleEnterBlur}
                  onFocus={handleValueFocus}
                  placeholder="R$ 0,00"
                  className={INPUT_EDITABLE + " w-24"}
                />
              </FieldRow>
              <FieldRow
                label={
                  <span className="inline-flex items-center gap-1">
                    Vlr foto extra
                    {hasDescontoProgressivo && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center h-3.5 px-1 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[9px] font-semibold cursor-help border border-emerald-200/60 dark:border-emerald-500/30">
                              %
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            <div className="font-semibold mb-1">Desconto progressivo aplicado</div>
                            <div>Preço de tabela: {formatCurrency(precoBaseTabela)}</div>
                            <div>
                              Preço cobrado: <strong>{formatCurrency(precoEfetivo)}</strong>
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
                            Sincronizado com a galeria. Editar aqui sobrescreve o valor recebido.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                }
              >
                <div className="flex items-center gap-1.5">
                  <Input
                    value={valorFotoExtraValue}
                    onChange={(e) => setValorFotoExtraValue(e.target.value)}
                    onBlur={handleValorFotoExtraBlur}
                    onKeyDown={handleEnterBlur}
                    onFocus={handleValueFocus}
                    placeholder="R$ 0,00"
                    className={INPUT_EDITABLE + " w-24"}
                  />
                  {session.extrasOverridden && hasDescontoProgressivo && !galeriaHasSales && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Restaurar valor do pacote? Isso re-vincula os extras à regra congelada do pacote.")) {
                                onFieldUpdate(session.id, "resyncExtrasWithGallery", true);
                              }
                            }}
                            className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                            aria-label="Restaurar preço do pacote"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-xs">
                          Restaurar valor do pacote (re-vincula à regra congelada)
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </FieldRow>
            </div>
          </div>
        </div>

        {/* BLOCO 2 — Adicionais */}
        <div className="rounded-2xl border border-stone-200/70 dark:border-border/40 bg-card/40 dark:bg-card/20 p-4 sm:p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <SectionHeader
              icon={Plus}
              title="ADICIONAIS"
              subtitle="Fotos extras, produtos e observações."
            />
            <div className="mt-2">
              <FieldRow
                label={
                  <span className="inline-flex items-center gap-1">
                    Qtd fotos extras
                    {galeriaHasSales && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock className="h-3 w-3 text-muted-foreground/60" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            Sincronizado com a galeria.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                }
              >
                <Input
                  type="number"
                  min={0}
                  value={qtdFotosExtraValue}
                  onChange={(e) => setQtdFotosExtraValue(e.target.value)}
                  onBlur={handleQtdFotosExtraBlur}
                  onKeyDown={handleEnterBlur}
                  onFocus={handleValueFocus}
                  placeholder="0"
                  className={INPUT_EDITABLE + " w-20"}
                />
              </FieldRow>
              <FieldRow label="Total fotos extras">
                <span className={VALUE_STRONG}>
                  {hasGaleria && extraCalcLoading ? "…" : valorFotoExtraTotal}
                </span>
                {(() => {
                  const extrasBadgeStatus = hasGaleria
                    ? extrasTotalCanonico <= 0
                      ? "sem_vendas"
                      : extrasPagoCanonico > 0 && extrasPendente > 0
                        ? "parcial"
                        : extrasFullyPaid
                          ? "pago"
                          : extrasPendente > 0
                            ? "pendente"
                            : session.galeriaStatusPagamento
                    : session.galeriaStatusPagamento;
                  if (extrasBadgeStatus === "parcial") {
                    return (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <FotosExtrasPaymentBadge status="parcial" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Pago {formatCurrency(extrasPagoCanonico)} · Pendente {formatCurrency(extrasPendente)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }
                  return <FotosExtrasPaymentBadge status={extrasBadgeStatus} />;
                })()}
                {session.extrasOverridden && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center h-5 px-1.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[9px] font-semibold border border-amber-200/60 dark:border-amber-500/30 cursor-help">
                          Manual
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Valores fixados manualmente. Para voltar aos valores da galeria, ajuste manualmente.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </FieldRow>
              {extrasPendente > 0 && (
                <FieldRow label="Pendente extras">
                  <span className="text-[13px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatCurrency(extrasPendente)}
                  </span>
                </FieldRow>
              )}
              <FieldRow label="Total produtos">
                <span className={VALUE_STRONG}>{formatCurrency(valorProdutosTotal)}</span>
              </FieldRow>
              <FieldRow label="Adicional">
                <Input
                  value={adicionalValue}
                  onChange={(e) => setAdicionalValue(e.target.value)}
                  onBlur={handleAdicionalBlur}
                  onKeyDown={handleEnterBlur}
                  onFocus={handleValueFocus}
                  placeholder="R$ 0,00"
                  className={INPUT_EDITABLE + " w-24"}
                />
              </FieldRow>
              <FieldRow label="Obs" align="col">
                <Textarea
                  value={obsValue}
                  onChange={(e) => setObsValue(e.target.value)}
                  onBlur={handleObsBlur}
                  placeholder="Observações..."
                  className="text-[12px] min-h-[58px] bg-muted/25 dark:bg-muted/35 hover:bg-muted/50 focus:bg-background border border-border/40 hover:border-border/70 focus:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md p-2.5 resize-none transition-all placeholder:text-muted-foreground/45 shadow-2xs leading-relaxed"
                />
              </FieldRow>
            </div>
          </div>
        </div>

        {/* BLOCO 3 — Produtos (resumo operacional) */}
        <div className="rounded-2xl border border-stone-200/70 dark:border-border/40 bg-card/40 dark:bg-card/20 p-4 sm:p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <SectionHeader
              icon={Package}
              title="PRODUTOS"
              subtitle="Produtos vinculados a esta sessão."
              action={
                onOpenProdutos ? (
                  <button
                    type="button"
                    onClick={onOpenProdutos}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F6F1EA] dark:bg-[#342A1D] text-[#82643E] dark:text-[#E5C497] border border-[#E5D7C3] dark:border-[#52412B] hover:bg-[#EFE6DA] transition-colors shadow-2xs"
                  >
                    Gerenciar
                  </button>
                ) : null
              }
            />
            <div className="mt-2">
              <ProdutosSummaryBlock
                produtos={session.produtosList}
                onOpenManager={() => onOpenProdutos?.()}
                formatCurrency={formatCurrency}
              />
              {(session.produtosList?.length ?? 0) > 0 && (
                <div className="mt-2 border-t border-border/15 pt-1">
                  {(() => {
                    const info = computeProductNextAction(session.produtosList as any);
                    return (
                      <>
                        <FieldRow label="Produtos vendidos">
                          <span className={VALUE_STRONG}>{info.total}</span>
                        </FieldRow>
                        <FieldRow label="Total produtos">
                          <span className={VALUE_STRONG}>
                            {formatCurrency(valorProdutosTotal)}
                          </span>
                        </FieldRow>
                        <FieldRow label="Produção">
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground">
                            <span
                              aria-hidden
                              className={`h-1.5 w-1.5 rounded-full ${info.dotClass}`}
                            />
                            {info.label || "—"}
                          </span>
                        </FieldRow>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BLOCO 4 — Ações */}
        <div className="rounded-2xl border border-stone-200/70 dark:border-border/40 bg-card/40 dark:bg-card/20 p-4 sm:p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <SectionHeader
              icon={Zap}
              title="AÇÕES"
              subtitle="Ações rápidas para esta sessão."
            />
            <div className="mt-2">
              <ExpandedActions
                session={session}
                onCobrar={() => setShowChargeModal(true)}
                onCobrarExtras={() => {
                  setShowExtraChargeModal(true);
                }}
                onCobrarTudo={
                  extrasPendente > 0.001 && pendenteSessaoSugerido > 0.001
                    ? () => {
                        setCombinedIntent("sessao_e_extras");
                        setShowCombinedChargeModal(true);
                      }
                    : undefined
                }
                extrasPendente={extrasPendente}
                extrasFullyPaid={extrasFullyPaid}
                sessaoPendente={pendenteSessaoSugerido}
                hasGaleria={hasGaleria}
                onAbrirPagamentos={() => setWorkflowPaymentsOpen(true)}
                onRegistrarPagamento={() => setShowManualPaymentModal(true)}
                canRegistrar={pendenteVisual > 0.001}
              />
            </div>
          </div>
        </div>
      </div>

      <ExpandedFinancialFooter
        total={totalVisual}
        valorPago={valorPagoDisplay}
        pendente={pendenteVisual}
        formatCurrency={formatCurrency}
        creditSlot={
          session.clienteId ? (
            <SessionCreditBadge
              clienteId={session.clienteId}
              sessionId={session.sessionId || session.id}
              sessionPendente={pendenteVisual}
            />
          ) : null
        }
      />

      {workflowPaymentsOpen && (
        <WorkflowPaymentsModal
          isOpen={workflowPaymentsOpen}
          onClose={() => {
            setWorkflowPaymentsOpen(false);
            window.dispatchEvent(
              new CustomEvent("payment-created", {
                detail: {
                  sessionId: session.sessionId ?? null,
                  sessionUuid: session.id,
                  source: "workflow-payments-modal",
                },
              }),
            );
          }}
          sessionData={session}
          valorTotalCalculado={totalVisual}
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
        valorSugerido={pendenteSessaoSugerido}
      />

      <ChargeModal
        isOpen={showExtraChargeModal}
        onClose={() => setShowExtraChargeModal(false)}
        clienteId={session.clienteId || ""}
        clienteNome={session.nome || "Cliente"}
        clienteWhatsapp={session.whatsapp}
        sessionId={session.sessionId || session.id}
        galeriaId={resolvedGalleryId || null}
        valorSugerido={extrasPendente}
        finalidade="fotos_extras"
        qtdFotos={fin.qtdExtras || Number(session.qtdFotosExtra) || 0}
        nomeSessao={session.pacote || session.nome}
      />

      {showCombinedChargeModal && (
        <CombinedChargeModal
          isOpen={showCombinedChargeModal}
          onClose={() => setShowCombinedChargeModal(false)}
          clienteId={session.clienteId || ""}
          clienteNome={session.nome || "Cliente"}
          clienteWhatsapp={session.whatsapp}
          sessionId={session.sessionId || session.id}
          galeriaId={resolvedGalleryId ?? null}
          valorSessaoComponente={
            // Intenção EXPLÍCITA do clique — nunca inferir por comparação numérica.
            combinedIntent === "extras_only" ? 0 : pendenteSessaoSugerido
          }
          valorExtrasComponente={extrasPendente}
          qtdFotosExtras={fin.qtdExtras || Number(session.qtdFotosExtra) || 0}
          snapshotFotosIncluidas={extraCalc?.included_count ?? null}
          nomeSessao={session.pacote || session.nome}
        />
      )}




      <OverrideExtrasDialog
        pendingExtraEdit={pendingExtraEdit}
        onConfirm={confirmExtraEdit}
        onCancel={cancelExtraEdit}
      />

      <ManualPaymentModal
        isOpen={showManualPaymentModal}
        onClose={() => setShowManualPaymentModal(false)}
        session={session}
        sessaoPendente={pendenteSessaoSugerido}
        extrasPendente={extrasPendente}
        hasGaleria={hasGaleria}
      />


    </div>
  );
}
