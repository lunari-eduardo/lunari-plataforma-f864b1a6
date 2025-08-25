import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Plus, Edit, Trash2, CheckCircle2, Clock, Calendar, AlertTriangle, DollarSign, Package, X } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { useSessionPayments } from '@/hooks/useSessionPayments';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { PaymentConfigModalExpanded } from '@/components/crm/PaymentConfigModalExpanded';
import { EditPaymentModal } from '@/components/crm/EditPaymentModal';
import { SessionData } from '@/types/workflow';
interface WorkflowPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: SessionData;
  valorTotalCalculado?: number;
  onPaymentUpdate: (sessionId: string, totalPaid: number, fullPaymentsArray?: any[]) => void;
}
export function WorkflowPaymentsModal({
  isOpen,
  onClose,
  sessionData,
  valorTotalCalculado,
  onPaymentUpdate
}: WorkflowPaymentsModalProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SessionPaymentExtended | null>(null);

  // Converter pagamentos existentes para o novo formato
  const convertExistingPayments = (payments: any[]): SessionPaymentExtended[] => {
    if (!payments || !Array.isArray(payments)) return [];
    return payments.map(p => {
      // Determinar tipo e status baseado nos dados existentes
      let tipo = p.tipo || 'pago';
      let statusPagamento = p.statusPagamento || 'pago';

      // Se tem dataVencimento mas não tem data de pagamento, é agendado/pendente
      if (p.dataVencimento && !p.data) {
        tipo = 'agendado';
        statusPagamento = 'pendente';

        // Verificar se está atrasado
        const hoje = new Date();
        const vencimento = new Date(p.dataVencimento);
        if (vencimento < hoje) {
          statusPagamento = 'atrasado';
        }
      }

      // Se tem numeroParcela, é parcelado
      if (p.numeroParcela && p.totalParcelas) {
        tipo = 'parcelado';
        if (!p.data) {
          statusPagamento = 'pendente';
        }
      }

      // Ajustar origem para parcelado quando necessário
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
    totalPendente,
    addPayment,
    editPayment,
    deletePayment,
    markAsPaid,
    createInstallments,
    schedulePayment
  } = useSessionPayments(sessionData.id, convertExistingPayments(sessionData.pagamentos || []));

  // Converter de volta para formato legado para sincronização
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

  // Atualizar workflow quando pagamentos mudarem
  useEffect(() => {
    const legacyPayments = convertToLegacyPayments(payments);
    onPaymentUpdate(sessionData.id, totalPago, legacyPayments);
  }, [payments, totalPago, sessionData.id, onPaymentUpdate]);
  const getStatusBadge = (payment: SessionPaymentExtended) => {
    const {
      statusPagamento
    } = payment;
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
    if (statusPagamento === 'atrasado') {
      return <Badge className="bg-red-100 text-red-800 border-red-200">Atrasado</Badge>;
    }
    return <Badge variant="outline">{statusPagamento}</Badge>;
  };
  const getOriginIcon = (origem: string, observacoes?: string) => {
    // Se observações incluir "entrada", mostrar ícone de dinheiro
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
      default:
        return <DollarSign className="h-3 w-3" />;
    }
  };
  const getOriginLabel = (origem: string, observacoes?: string) => {
    // Se observações incluir "entrada", mostrar "Entrada"
    if (observacoes && observacoes.toLowerCase().includes('entrada')) {
      return 'Entrada';
    }
    switch (origem) {
      case 'agenda':
        return 'Agenda';
      case 'workflow_rapido':
        return 'Workflow Rápido';
      case 'parcelado':
        return 'Parcelado';
      default:
        return 'Manual';
    }
  };
  const valorTotal = valorTotalCalculado ?? (parseFloat(String(sessionData.total || '0').replace(/[^\d,]/g, '').replace(',', '.')) || 0);
  const valorRestante = Math.max(0, valorTotal - totalPago);
  return <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm sm:max-w-md lg:max-w-4xl max-w-[95vw] max-h-[90vh] overflow-y-auto sm:px-4 sm:mx-[3px] px-0 mx-0">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm sm:text-lg lg:text-xl font-semibold flex items-center gap-1 sm:gap-2">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-primary" />
                <span className="truncate text-base">Gerenciar Pagamentos - {sessionData.nome}</span>
              </DialogTitle>
              
            </div>
            
          </DialogHeader>

          <div className="space-y-2 sm:space-y-4 lg:space-y-6">
            {/* Resumo Financeiro */}
            <Card className="bg-muted/30">
              <CardContent className="p-2 sm:p-3 lg:p-4">
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
                    <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Pendente</p>
                    <p className="font-bold text-yellow-600 text-xs sm:text-sm">{formatCurrency(totalPendente)}</p>
                  </div>
                  <div>
                    <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Restante</p>
                    <p className="font-bold text-red-600 text-xs sm:text-sm">{formatCurrency(valorRestante)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Histórico de Movimentações */}
            <Card className="px-0 mx-0">
              <CardHeader className="pb-2 sm:pb-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold flex items-center gap-1 sm:gap-2">
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-primary" />
                    Histórico de Movimentações
                  </CardTitle>
                  <Button onClick={() => setShowPaymentModal(true)} size="sm" className="gap-1 sm:gap-2 h-6 sm:h-8">
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline text-xs sm:text-sm">Gerenciar Pagamentos</span>
                    <span className="sm:hidden text-xs">Adicionar</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2 sm:p-3 lg:p-6">
                {payments.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Nenhum pagamento registrado</p>
                    <p className="text-sm">Clique em "Gerenciar Pagamentos" para começar</p>
                  </div> : <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Data / Vencimento</TableHead>
                          <TableHead className="min-w-[80px]">Valor</TableHead>
                          <TableHead className="min-w-[100px] hidden sm:table-cell">Tipo / Status</TableHead>
                          <TableHead className="min-w-[80px] hidden md:table-cell">Origem</TableHead>
                          <TableHead className="text-right min-w-[80px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {payments.sort((a, b) => {
                      const dateA = new Date(a.dataVencimento || a.data || '1970-01-01');
                      const dateB = new Date(b.dataVencimento || b.data || '1970-01-01');
                      return dateB.getTime() - dateA.getTime();
                    }).map(payment => <TableRow key={payment.id}>
                            <TableCell className="px-0 mx-0">
                              <div className="space-y-1">
                                {payment.statusPagamento === 'pago' && payment.data && <div className="flex items-center gap-1 text-sm">
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                    <span className="font-medium">
                                      {formatDateForDisplay(payment.data)}
                                    </span>
                                  </div>}
                                {payment.dataVencimento && <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      Venc: {formatDateForDisplay(payment.dataVencimento)}
                                    </span>
                                  </div>}
                                {payment.numeroParcela && <div className="text-xs text-muted-foreground">
                                    Parcela {payment.numeroParcela}/{payment.totalParcelas}
                                  </div>}
                              </div>
                            </TableCell>
                            <TableCell className="px-0 mx-0">
                              <span className={`font-semibold ${payment.statusPagamento === 'pago' ? 'text-green-600' : payment.statusPagamento === 'atrasado' ? 'text-red-600' : 'text-yellow-600'}`}>
                                {formatCurrency(payment.valor)}
                              </span>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                  {payment.tipo}
                                </div>
                                {getStatusBadge(payment)}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-1 text-xs">
                                {getOriginIcon(payment.origem, payment.observacoes)}
                                <span>
                                  {getOriginLabel(payment.origem, payment.observacoes)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right mx-0 px-0">
                              <div className="flex justify-end gap-1">
                                {payment.statusPagamento === 'pendente' && <Button size="sm" variant="ghost" onClick={() => markAsPaid(payment.id)} className="h-8 w-8 p-0" title="Marcar como pago">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  </Button>}
                                {payment.editavel && <>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingPayment(payment)} className="h-8 w-8 p-0" title="Editar pagamento">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => deletePayment(payment.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title="Excluir pagamento">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>}
                              </div>
                            </TableCell>
                          </TableRow>)}
                    </TableBody>
                    </Table>
                  </div>}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modais de Gerenciamento */}
      <PaymentConfigModalExpanded isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} sessionId={sessionData.id} clienteId={sessionData.clienteId} valorTotal={valorTotal} valorJaPago={totalPago} valorRestante={valorRestante} clienteNome={sessionData.nome} onAddPayment={addPayment} onCreateInstallments={createInstallments} onSchedulePayment={schedulePayment} />

      {editingPayment && <EditPaymentModal payment={editingPayment} onClose={() => setEditingPayment(null)} onSave={updates => {
      editPayment(editingPayment.id, updates);
      setEditingPayment(null);
    }} />}
    </>;
}