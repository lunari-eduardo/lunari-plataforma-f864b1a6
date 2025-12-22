import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Plus, Edit, Trash2, CheckCircle2, Calendar, DollarSign, Package, Send, QrCode, Link2, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay, formatDateTimeForDisplay } from '@/utils/dateUtils';
import { useSessionPayments } from '@/hooks/useSessionPayments';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { PaymentConfigModalExpanded } from '@/components/crm/PaymentConfigModalExpanded';
import { EditPaymentModal } from '@/components/crm/EditPaymentModal';
import { ChargeModal } from '@/components/cobranca/ChargeModal';
import { Skeleton } from '@/components/ui/skeleton';
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
  const [editingPayment, setEditingPayment] = useState<SessionPaymentExtended | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<SessionPaymentExtended | null>(null);

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
    totalAgendado,
    totalPendente,
    isLoading,
    addPayment,
    editPayment,
    deletePayment,
    markAsPaid,
    createInstallments,
    schedulePayment
  } = useSessionPayments(sessionData.id, convertExistingPayments(sessionData.pagamentos || []));

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

  // Update when payments change
  useEffect(() => {
    const legacyPayments = convertToLegacyPayments(payments);
    onPaymentUpdate(sessionData.id, totalPago, legacyPayments);
  }, [payments, totalPago, sessionData.id, onPaymentUpdate]);

  const getStatusBadge = (payment: SessionPaymentExtended) => {
    const { statusPagamento } = payment;
    if (statusPagamento === 'pago') {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
    }
    if (statusPagamento === 'pendente') {
      const isOverdue = payment.dataVencimento && new Date(payment.dataVencimento) < new Date();
      if (isOverdue) {
        return <Badge className="bg-red-100 text-red-800 border-red-200">Atrasado</Badge>;
      }
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
    }
    return <Badge variant="outline">{statusPagamento}</Badge>;
  };

  const getOriginIcon = (origem: string, observacoes?: string) => {
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

  const valorTotal = typeof sessionData.total === 'number' 
    ? sessionData.total 
    : parseFloat(sessionData.total?.replace('R$', '').replace(/\./g, '').replace(',', '.').trim() || '0');
  const valorRestante = Math.max(0, valorTotal - totalPago);

  // Shared content
  const content = (
    <>
      {/* Financial Summary */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 text-center">
            <div>
              <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="font-bold text-primary text-xs sm:text-sm">{formatCurrency(valorTotal)}</p>
            </div>
            <div>
              <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Pago</p>
              <p className="font-bold text-green-600 text-xs sm:text-sm">{formatCurrency(totalPago)}</p>
            </div>
            <div>
              <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Agendado</p>
              <p className="font-bold text-orange-500 text-xs sm:text-sm">{formatCurrency(totalAgendado)}</p>
            </div>
            <div>
              <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Pendente</p>
              <p className="font-bold text-red-600 text-xs sm:text-sm">{formatCurrency(valorRestante)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle className="text-sm md:text-lg font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Histórico de Movimentações
            </CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                onClick={() => setShowChargeModal(true)} 
                variant="outline"
                className="gap-2 flex-1 sm:flex-none h-8 text-xs border-primary text-primary hover:bg-primary/10" 
                size="sm"
              >
                <Send className="h-3 w-3 md:h-4 md:w-4" />
                Cobrar
              </Button>
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
        <CardContent>
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
                            {payment.statusPagamento === 'pago' && (payment.createdAt || payment.data) && (
                              <div className="flex items-center gap-1 text-sm">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
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
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${payment.statusPagamento === 'pago' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {formatCurrency(payment.valor)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">
                              {payment.tipo}
                            </div>
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
                            {payment.editavel && (
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
                                  onClick={() => {
                                    // Se pagamento já está pago, pedir confirmação
                                    if (payment.statusPagamento === 'pago') {
                                      setPaymentToDelete(payment);
                                    } else {
                                      deletePayment(payment.id);
                                    }
                                  }}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                                </Button>
                              </>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pagamento confirmado?</AlertDialogTitle>
            <AlertDialogDescription>
              Este pagamento de <strong>{paymentToDelete ? formatCurrency(paymentToDelete.valor) : ''}</strong> já foi marcado como pago.
              Tem certeza que deseja excluí-lo? Esta ação não pode ser desfeita e o valor será removido do total pago.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (paymentToDelete) {
                  deletePayment(paymentToDelete.id);
                  setPaymentToDelete(null);
                }
              }}
            >
              Excluir Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Charge Modal */}
      <ChargeModal
        isOpen={showChargeModal}
        onClose={() => setShowChargeModal(false)}
        clienteId={sessionData.clienteId || ''}
        clienteNome={sessionData.nome || 'Cliente'}
        clienteWhatsapp={sessionData.whatsapp}
        sessionId={sessionData.id}
        valorSugerido={valorRestante}
      />
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
