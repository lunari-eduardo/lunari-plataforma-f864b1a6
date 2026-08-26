import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Plus, Edit, Trash2, CheckCircle2, Calendar, DollarSign, Package, Send, QrCode, Link2, Loader2, RotateCcw, Images, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay, formatDateTimeForDisplay } from '@/utils/dateUtils';
import { useSessionPayments } from '@/hooks/useSessionPayments';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { PaymentConfigModalExpanded } from '@/components/crm/PaymentConfigModalExpanded';
import { EditPaymentModal } from '@/components/crm/EditPaymentModal';
import { ChargeModal } from '@/components/cobranca/ChargeModal';
import { ExtraChargeModal } from '@/components/cobranca/ExtraChargeModal';
import { CombinedChargeModal } from '@/components/cobranca/CombinedChargeModal';
import { Skeleton } from '@/components/ui/skeleton';
import { RefundDialog } from '@/components/payments/RefundDialog';
import { useSessionFinancialsWithExtras } from '@/features/workflow/hooks/useSessionFinancialsWithExtras';
import { supabase } from '@/integrations/supabase/client';
interface SessionPaymentsManagerProps {
  sessionData: any;
  onPaymentUpdate: (sessionId: string, totalPaid: number, fullPaymentsArray?: any[]) => void;
  displayMode?: 'modal' | 'card';
  isOpen?: boolean;
  onClose?: () => void;
}

export function SessionPaymentsManager({
  sessionData,
  onPaymentUpdate,
  displayMode = 'card',
  isOpen,
  onClose
}: SessionPaymentsManagerProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showExtraChargeModal, setShowExtraChargeModal] = useState(false);
  /** "Cobrar tudo": abre UM único modal (finalidade `sessao_e_extras`, link único). */
  const [showCombinedChargeModal, setShowCombinedChargeModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SessionPaymentExtended | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<SessionPaymentExtended | null>(null);
  const [paymentToRefund, setPaymentToRefund] = useState<SessionPaymentExtended | null>(null);
  const [refundMotivo, setRefundMotivo] = useState('');

  // Convert existing payments to extended format
  const convertExistingPayments = (payments: any[]): SessionPaymentExtended[] => {
    if (!payments || !Array.isArray(payments)) return [];
    return payments.map(p => {
      let tipo = p.tipo || 'pago';
      let statusPagamento = p.statusPagamento || 'pago';

      if (p.dataVencimento && !p.data) {
        tipo = 'agendado';
        statusPagamento = 'pendente';
      }

      if (p.numeroParcela && p.totalParcelas) {
        tipo = 'parcelado';
        if (!p.data) {
          statusPagamento = 'pendente';
        }
      }

      let origem = p.origem || 'manual';
      if (p.numeroParcela && p.totalParcelas && origem !== 'parcelado') {
        origem = 'parcelado';
      }

      return {
        id: p.id || `legacy-${Date.now()}-${Math.random()}`,
        valor: typeof p.valor === 'number' ? p.valor : parseFloat(String(p.valor || '0')),
        data: p.data || '',
        dataVencimento: p.dataVencimento,
        tipo: tipo as 'pago' | 'agendado' | 'parcelado',
        statusPagamento: statusPagamento as 'pendente' | 'pago' | 'atrasado' | 'cancelado',
        numeroParcela: p.numeroParcela,
        totalParcelas: p.totalParcelas,
        origem: origem as 'agenda' | 'workflow_rapido' | 'manual' | 'parcelado',
        editavel: p.origem !== 'agenda' && p.editavel !== false,
        forma_pagamento: p.forma_pagamento,
        observacoes: p.observacoes
      };
    });
  };

  const {
    payments,
    totalPago,
    totalEstornado,
    totalRecebido,
    totalTaxas,
    totalAgendado,
    totalPendente,
    isLoading,
    addPayment,
    editPayment,
    deletePayment,
    refundPayment,
    markAsPaid,
    createInstallments,
    schedulePayment
  } = useSessionPayments(sessionData.id, convertExistingPayments(sessionData.pagamentos || []));

  // Painel financeiro composto — combina RPC da sessão + snapshot canônico da
  // galeria (desconto progressivo). Mesma lógica usada nos cards do Workflow,
  // eliminando divergências entre card e modal (fotos extras invisíveis, etc.).
  const fin = useSessionFinancialsWithExtras(
    sessionData.id,
    sessionData.galeriaId,
    sessionData.sessionId,
  );

  // Convert back to legacy format for synchronization
  const convertToLegacyPayments = (extendedPayments: SessionPaymentExtended[]) => {
    return extendedPayments.map(p => ({
      id: p.id,
      valor: p.valor,
      data: p.data,
      forma_pagamento: p.forma_pagamento,
      observacoes: p.observacoes,
      tipo: p.tipo,
      statusPagamento: p.statusPagamento,
      dataVencimento: p.dataVencimento,
      numeroParcela: p.numeroParcela,
      totalParcelas: p.totalParcelas,
      origem: p.origem,
      editavel: p.editavel
    }));
  };

  // Removed: useEffect that called onPaymentUpdate on every payments change.
  // valor_pago is now managed entirely by DB triggers. No frontend sync needed.

  // Reconciliação de fallback: quando o painel abre, varre TODAS as cobranças
  // pendentes/parcialmente pagas desta sessão e aciona `check-payment-status`
  // para cada uma. Cobre o cenário em que o webhook (InfinitePay/Mercado Pago)
  // falhou silenciosamente e o front continua vendo "pendente".
  useEffect(() => {
    const isVisible = displayMode === 'card' || isOpen === true;
    if (!isVisible) return;
    const sid = sessionData?.sessionId || sessionData?.id;
    if (!sid) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('cobrancas')
          .select('id, status')
          .eq('session_id', sid)
          .in('status', ['pendente', 'parcialmente_pago']);
        if (error || !data || cancelled) return;
        for (const c of data) {
          if (cancelled) return;
          try {
            await supabase.functions.invoke('check-payment-status', {
              body: { cobrancaId: c.id, forceUpdate: false },
            });
          } catch (e) {
            console.warn('[SessionPaymentsManager] reconcile falhou para', c.id, e);
          }
        }
      } catch (e) {
        console.warn('[SessionPaymentsManager] reconcile geral falhou', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [displayMode, isOpen, sessionData?.id, sessionData?.sessionId]);

  // Badges neutros (Silent Luxury): superfície discreta + tipografia semântica.
  const BADGE_BASE = 'border-border/20 bg-muted/40 font-medium';
  const BADGE_OK = `${BADGE_BASE} text-emerald-600 dark:text-emerald-500`;
  const BADGE_WARN = `${BADGE_BASE} text-accent-gold`;
  const BADGE_DANGER = `${BADGE_BASE} text-destructive`;
  const BADGE_NEUTRAL = `${BADGE_BASE} text-muted-foreground`;

  const getStatusBadge = (payment: SessionPaymentExtended) => {
    // Se tem statusRecebimento (parcela Asaas), usar esse status
    if (payment.statusRecebimento) {
      switch (payment.statusRecebimento) {
        case 'confirmado':
          return <Badge className={BADGE_WARN}>Confirmado</Badge>;
        case 'recebido':
          return <Badge className={BADGE_OK}>Recebido</Badge>;
        case 'antecipado':
          return <Badge className={BADGE_NEUTRAL}>Antecipado</Badge>;
        case 'pendente':
          return <Badge className={BADGE_NEUTRAL}>Pendente</Badge>;
      }
    }

    const { statusPagamento } = payment;
    if (statusPagamento === 'estornado') {
      return <Badge className={BADGE_DANGER}>Estornado</Badge>;
    }
    if (statusPagamento === 'pago') {
      return <Badge className={BADGE_OK}>Pago</Badge>;
    }
    if (statusPagamento === 'pendente') {
      const isOverdue = payment.dataVencimento && new Date(payment.dataVencimento) < new Date();
      if (isOverdue) {
        return <Badge className={BADGE_DANGER}>Atrasado</Badge>;
      }
      return <Badge className={BADGE_WARN}>Pendente</Badge>;
    }
    return <Badge variant="outline">{statusPagamento}</Badge>;
  };


  const getOriginIcon = (origem: string, observacoes?: string) => {
    // Crédito do cliente
    if (origem === 'credito' || observacoes?.toLowerCase().includes('crédito do cliente')) {
      return <CreditCard className="h-3 w-3 text-emerald-600" />;
    }
    // Detectar InfinitePay
    if (origem === 'infinitepay' || observacoes?.toLowerCase().includes('infinitepay')) {
      return <Link2 className="h-3 w-3 text-green-600" />;
    }
    // Detectar Asaas
    if (origem === 'asaas' || observacoes?.toLowerCase().includes('asaas')) {
      return <CreditCard className="h-3 w-3 text-blue-600" />;
    }
    // Detectar Mercado Pago pela origem ou observações
    if (origem === 'mercadopago' || observacoes?.toLowerCase().includes('mercado pago')) {
      if (observacoes?.toLowerCase().includes('pix')) {
        return <QrCode className="h-3 w-3 text-primary" />;
      }
      return <Link2 className="h-3 w-3 text-primary" />;
    }
    if (observacoes && observacoes.toLowerCase().includes('entrada')) {
      return <DollarSign className="h-3 w-3" />;
    }
    switch (origem) {
      case 'agenda':
        return <Calendar className="h-3 w-3" />;
      case 'workflow_rapido':
        return <CreditCard className="h-3 w-3" />;
      case 'parcelado':
        return <Package className="h-3 w-3" />;
      case 'supabase':
        return <DollarSign className="h-3 w-3" />;
      default:
        return <DollarSign className="h-3 w-3" />;
    }
  };

  const getOriginLabel = (origem: string, observacoes?: string) => {
    // Crédito do cliente
    if (origem === 'credito' || observacoes?.toLowerCase().includes('crédito do cliente')) {
      return 'Crédito do cliente';
    }
    // Detectar InfinitePay
    if (origem === 'infinitepay' || observacoes?.toLowerCase().includes('infinitepay')) {
      return 'InfinitePay';
    }
    // Detectar Asaas
    if (origem === 'asaas' || observacoes?.toLowerCase().includes('asaas')) {
      if (observacoes?.toLowerCase().includes('pix')) {
        return 'Pix Asaas';
      }
      return 'Link Asaas';
    }
    // Detectar Mercado Pago pela origem ou observações
    if (origem === 'mercadopago' || observacoes?.toLowerCase().includes('mercado pago')) {
      if (observacoes?.toLowerCase().includes('pix')) {
        return 'Pix MP';
      }
      return 'Link MP';
    }
    if (observacoes && observacoes.toLowerCase().includes('entrada')) {
      return 'Entrada';
    }
    switch (origem) {
      case 'agenda':
        return 'Agenda';
      case 'workflow_rapido':
        return 'Workflow';
      case 'parcelado':
        return 'Parcelado';
      case 'supabase':
        return 'Manual';
      default:
        return 'Manual';
    }
  };

  // Valores autoritativos combinam DB (sessão) + RPC canônica da galeria.
  // Fallback ao `sessionData.total` só em cold-start extremo (SSR/edge).
  const valorTotalFallback =
    typeof sessionData.total === 'number'
      ? sessionData.total
      : parseFloat(String(sessionData.total ?? '').replace('R$', '').replace(/\./g, '').replace(',', '.').trim() || '0');

  const valorTotal = fin.totalVisual > 0 ? fin.totalVisual : valorTotalFallback;
  const valorRestante = fin.totalVisual > 0 ? fin.pendenteTot : Math.max(0, valorTotalFallback - totalPago);
  const valorRestanteSessao = fin.totalVisual > 0 ? fin.pendenteSess : valorRestante;

  const showExtrasChip = fin.hasGaleria && fin.extrasIdeal > 0;
  // Modo card (perfil do cliente): Total/Cobrado já aparecem no cabeçalho da linha.
  const isCard = displayMode === 'card';
  const showTotalChip = !isCard;
  const showCobradoChip = !isCard || Math.abs(totalPago - totalRecebido) > 0.001;
  const GRID_BY_COUNT: Record<number, string> = {
    3: 'grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-2 lg:grid-cols-6',
    7: 'grid-cols-2 lg:grid-cols-7',
  };
  const chipCount =
    (showTotalChip ? 1 : 0) + (showExtrasChip ? 2 : 0) + (showCobradoChip ? 1 : 0) + 3;
  const gridCols = GRID_BY_COUNT[chipCount] ?? 'grid-cols-2 lg:grid-cols-5';



  const canCobrarSessao = valorRestanteSessao > 0.001;
  const canCobrarExtras = fin.hasGaleria && fin.extrasPend > 0.001;
  const canCobrarTudo = canCobrarSessao && canCobrarExtras;

  const handleCobrarTudo = () => {
    // Link único combinando sessão + extras (finalidade `sessao_e_extras`).
    setShowCombinedChargeModal(true);
  };

  // Shared content
  const content = (
    <>
      {/* Financial Summary */}
      <Card className={isCard ? 'mb-3 border-0 bg-transparent shadow-none' : 'mb-6'}>
        <CardContent className={isCard ? 'p-0 pb-3 border-b border-border/20' : 'pt-6'}>
          <div className={`grid ${gridCols} gap-2 sm:gap-3 lg:gap-4 text-center`}>
            {showTotalChip && (
              <div>
                <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="font-bold text-primary text-xs sm:text-sm">{formatCurrency(valorTotal)}</p>
              </div>
            )}
            {showExtrasChip && (
              <>
                <div>
                  <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Base sessão</p>
                  <p className="font-semibold text-foreground text-xs sm:text-sm">{formatCurrency(fin.baseSessao)}</p>
                </div>
                <div>
                  <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Extras</p>
                  <p className="font-semibold text-accent-gold text-xs sm:text-sm">
                    {formatCurrency(fin.extrasIdeal)}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    Pago {formatCurrency(fin.extrasPago)} · Pend {formatCurrency(fin.extrasPend)}
                  </p>
                </div>
              </>
            )}
            {showCobradoChip && (
              <div>
                <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Cobrado</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-500 text-xs sm:text-sm">{formatCurrency(totalPago)}</p>
              </div>
            )}
            <div>
              <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Recebido</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-500 text-xs sm:text-sm">{formatCurrency(totalRecebido)}</p>
              {totalTaxas > 0 && (
                <p className="text-2xs text-destructive">Taxas: -{formatCurrency(totalTaxas)}</p>
              )}
            </div>
            <div>
              <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Agendado</p>
              <p className="font-bold text-orange-500 text-xs sm:text-sm">{formatCurrency(totalAgendado)}</p>
            </div>
            <div>
              <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Pendente</p>
              <p className={`font-bold text-xs sm:text-sm ${valorRestante > 0.001 ? 'text-accent-gold' : 'text-muted-foreground'}`}>{formatCurrency(valorRestante)}</p>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Payment History */}
      <Card className={isCard ? 'border-0 bg-transparent shadow-none' : undefined}>
        <CardHeader className={isCard ? 'px-0 pt-0 pb-2' : undefined}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle className={isCard ? 'text-xs font-semibold flex items-center gap-2' : 'text-sm md:text-lg font-semibold flex items-center gap-2'}>
              <CreditCard className={isCard ? 'h-3.5 w-3.5 text-accent-gold' : 'h-4 w-4 md:h-5 md:w-5 text-primary'} />
              Histórico de Movimentações
            </CardTitle>

            <div className="flex gap-2 w-full sm:w-auto">
              {fin.hasGaleria ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2 flex-1 sm:flex-none h-8 text-xs border-primary text-primary hover:bg-primary/10"
                      size="sm"
                      disabled={!canCobrarSessao && !canCobrarExtras}
                    >
                      <Send className="h-3 w-3 md:h-4 md:w-4" />
                      Cobrar
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      disabled={!canCobrarSessao}
                      onClick={() => setShowChargeModal(true)}
                    >
                      <Send className="h-3.5 w-3.5 mr-2" />
                      <div className="flex-1">
                        <div className="text-xs font-medium">Cobrar sessão</div>
                        <div className="text-2xs text-muted-foreground">{formatCurrency(valorRestanteSessao)}</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canCobrarExtras}
                      onClick={() => setShowExtraChargeModal(true)}
                    >
                      <Images className="h-3.5 w-3.5 mr-2 text-amber-500" />
                      <div className="flex-1">
                        <div className="text-xs font-medium">Cobrar extras</div>
                        <div className="text-2xs text-muted-foreground">{formatCurrency(fin.extrasPend)}</div>
                      </div>
                    </DropdownMenuItem>
                    {canCobrarTudo && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleCobrarTudo}>
                          <Send className="h-3.5 w-3.5 mr-2 text-primary" />
                          <div className="flex-1">
                            <div className="text-xs font-medium">Cobrar tudo</div>
                            <div className="text-2xs text-muted-foreground">
                              {formatCurrency(valorRestanteSessao + fin.extrasPend)} · 1 link único
                            </div>
                          </div>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={() => setShowChargeModal(true)}
                  variant="outline"
                  disabled={!canCobrarSessao}
                  className="gap-2 flex-1 sm:flex-none h-8 text-xs border-primary text-primary hover:bg-primary/10"
                  size="sm"
                >
                  <Send className="h-3 w-3 md:h-4 md:w-4" />
                  Cobrar
                </Button>
              )}
              <Button
                onClick={() => setShowPaymentModal(true)}
                className="gap-2 flex-1 sm:flex-none h-8 text-xs"
                size="sm"
              >
                <Plus className="h-3 w-3 md:h-4 md:w-4" />
                Adicionar Pagamento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={isCard ? 'px-0 pb-0' : undefined}>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
              <p>Carregando pagamentos...</p>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pagamento registrado</p>
              <p className="text-sm">Clique em "Adicionar Pagamento" para começar</p>
            </div>
          ) : (
            <div className="-mx-2 px-2 overflow-y-auto max-h-[350px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Data / Vencimento</TableHead>
                    <TableHead className="text-xs md:text-sm">Valor</TableHead>
                    <TableHead className="text-xs md:text-sm">Tipo / Status</TableHead>
                    <TableHead className="text-xs md:text-sm">Origem</TableHead>
                    <TableHead className="text-right text-xs md:text-sm">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments
                    .sort((a, b) => {
                      // Ordenar por timestamp completo (createdAt) para precisão por hora
                      const timestampA = a.createdAt || a.dataVencimento || a.data || '';
                      const timestampB = b.createdAt || b.dataVencimento || b.data || '';
                      return timestampB.localeCompare(timestampA);
                    })
                    .map(payment => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div className="space-y-1">
                            {(payment.statusPagamento === 'pago' || payment.tipo === 'estorno') && (payment.createdAt || payment.data) && (
                              <div className="flex items-center gap-1 text-sm">
                                {payment.tipo === 'estorno' ? (
                                  <RotateCcw className="h-3 w-3 text-destructive" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                )}
                                <span className="font-medium">
                                  {formatDateTimeForDisplay(payment.createdAt || payment.data)}
                                </span>
                              </div>
                            )}
                            {payment.dataVencimento && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>Venc: {formatDateForDisplay(payment.dataVencimento)}</span>
                              </div>
                            )}
                            {payment.numeroParcela && (
                              <div className="text-xs text-muted-foreground">
                                Parcela {payment.numeroParcela}/{payment.totalParcelas}
                              </div>
                            )}
                            {payment.dataCreditoPrevista && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <DollarSign className="h-3 w-3 text-primary" />
                                <span>
                                  {payment.dataCreditoReal 
                                    ? `Creditado: ${formatDateForDisplay(payment.dataCreditoReal)}`
                                    : `Crédito: ${formatDateForDisplay(payment.dataCreditoPrevista)}`
                                  }
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${
                            payment.tipo === 'estorno' ? 'text-red-600 line-through' : 
                            payment.statusPagamento === 'pago' ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {payment.tipo === 'estorno' ? '-' : ''}{formatCurrency(payment.valor)}
                          </span>
                          {payment.valorLiquido != null && payment.valorLiquido < payment.valor && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Líquido: {formatCurrency(payment.valorLiquido)}
                              {payment.taxaTotal != null && payment.taxaTotal > 0 && ` (taxa: ${formatCurrency(payment.taxaTotal)})`}
                              {payment.taxaAntecipacao != null && payment.taxaAntecipacao > 0 && (
                                <span className="block">Antecipação: {formatCurrency(payment.taxaAntecipacao)}</span>
                              )}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {/* Só exibe o "tipo" quando ele acrescenta informação além do badge */}
                            {String(payment.tipo || '').toLowerCase() !==
                              String(payment.statusPagamento || '').toLowerCase() && (
                              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                {payment.tipo}
                              </div>
                            )}
                            {getStatusBadge(payment)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getOriginIcon(payment.origem, payment.observacoes)}
                            <span className="text-xs">
                              {getOriginLabel(payment.origem, payment.observacoes)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {payment.statusPagamento === 'pendente' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markAsPaid(payment.id)}
                                className="h-8 w-8 p-0"
                              >
                                <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
                              </Button>
                            )}
                            {payment.editavel && payment.statusPagamento !== 'pago' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingPayment(payment)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-3 w-3 md:h-4 md:w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deletePayment(payment.id)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                                </Button>
                              </>
                            )}
                            {payment.statusPagamento === 'pago' && payment.editavel && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingPayment(payment)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-3 w-3 md:h-4 md:w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setPaymentToRefund(payment)}
                                  className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                                  title="Estornar pagamento"
                                >
                                  <RotateCcw className="h-3 w-3 md:h-4 md:w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deletePayment(payment.id)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  title="Excluir registro (lançamento manual)"
                                >
                                  <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                                </Button>
                              </>
                            )}
                            {payment.statusPagamento === 'pago' && !payment.editavel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPaymentToRefund(payment)}
                                className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                                title="Estornar pagamento"
                              >
                                <RotateCcw className="h-3 w-3 md:h-4 md:w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <PaymentConfigModalExpanded
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        sessionId={sessionData.id}
        clienteId={sessionData.clienteId}
        valorTotal={valorTotal}
        valorJaPago={totalPago}
        valorRestante={valorRestante}
        clienteNome={sessionData.nome}
        onAddPayment={addPayment}
        onCreateInstallments={createInstallments}
        onSchedulePayment={schedulePayment}
      />

      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          onClose={() => setEditingPayment(null)}
          onSave={updates => {
            editPayment(editingPayment.id, updates);
            setEditingPayment(null);
          }}
        />
      )}

      {/* Refund Confirmation Dialog */}
      <RefundDialog
        payment={paymentToRefund}
        onClose={() => { setPaymentToRefund(null); setRefundMotivo(''); }}
        onConfirm={async (motivo, autoRefund, keepAsCredit) => {
          if (paymentToRefund) {
            const ok = await refundPayment(paymentToRefund.id, { motivo: motivo || undefined, autoRefund, keepAsCredit });
            if (ok) { setPaymentToRefund(null); setRefundMotivo(''); }
          }
        }}
      />

      {/* Charge Modal (sessão isolada) */}
      <ChargeModal
        isOpen={showChargeModal}
        onClose={() => setShowChargeModal(false)}
        clienteId={sessionData.clienteId || ''}
        clienteNome={sessionData.nome || 'Cliente'}
        clienteWhatsapp={sessionData.whatsapp}
        sessionId={sessionData.sessionId || sessionData.id}
        valorSugerido={valorRestanteSessao}
      />

      {/* Extra Charge Modal (fotos extras da galeria) */}
      {fin.resolvedGalleryId && (
        <ExtraChargeModal
          isOpen={showExtraChargeModal}
          onClose={() => setShowExtraChargeModal(false)}
          galeriaId={fin.resolvedGalleryId}
          clienteId={sessionData.clienteId}
          clienteNome={sessionData.nome}
          nomeSessao={sessionData.descricao || sessionData.categoria}
          clienteWhatsapp={sessionData.whatsapp}
        />
      )}

      {/* Combined Charge Modal — link único cobrindo sessão + extras */}
      {fin.resolvedGalleryId && showCombinedChargeModal && (
        <CombinedChargeModal
          isOpen={showCombinedChargeModal}
          onClose={() => setShowCombinedChargeModal(false)}
          clienteId={sessionData.clienteId || ''}
          clienteNome={sessionData.nome || 'Cliente'}
          clienteWhatsapp={sessionData.whatsapp}
          sessionId={sessionData.sessionId || sessionData.id}
          galeriaId={fin.resolvedGalleryId}
          valorSessaoComponente={valorRestanteSessao}
          valorExtrasComponente={fin.extrasPend}
          qtdFotosExtras={fin.qtdExtras || 0}
          nomeSessao={sessionData.descricao || sessionData.categoria}
        />
      )}
    </>
  );

  // Render as modal or card
  if (displayMode === 'modal') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg md:text-xl">Gerenciamento de Pagamentos</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {content}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return <div className="space-y-6">{content}</div>;
}
