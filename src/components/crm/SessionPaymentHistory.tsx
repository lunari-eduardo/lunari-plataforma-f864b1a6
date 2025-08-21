import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  CreditCard, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Calendar,
  AlertTriangle,
  DollarSign,
  Package
} from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { useSessionPayments } from '@/hooks/useSessionPayments';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { PaymentConfigModalExpanded } from './PaymentConfigModalExpanded';
import { EditPaymentModal } from './EditPaymentModal';

interface SessionPaymentHistoryProps {
  sessionData: any;
  onPaymentUpdate: (sessionId: string, totalPaid: number) => void;
}

export function SessionPaymentHistory({ sessionData, onPaymentUpdate }: SessionPaymentHistoryProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SessionPaymentExtended | null>(null);

  // Converter pagamentos existentes para o novo formato
  const convertExistingPayments = (payments: any[]): SessionPaymentExtended[] => {
    if (!payments || !Array.isArray(payments)) return [];
    
    return payments.map(p => ({
      id: p.id || `legacy-${Date.now()}-${Math.random()}`,
      valor: typeof p.valor === 'number' ? p.valor : parseFloat(String(p.valor || '0')),
      data: p.data || '',
      tipo: 'pago' as const,
      statusPagamento: 'pago' as const,
      origem: (p.origem || 'manual') as 'agenda' | 'workflow_rapido' | 'manual' | 'parcelado',
      editavel: p.origem !== 'agenda',
      forma_pagamento: p.forma_pagamento,
      observacoes: p.observacoes
    }));
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

  // Atualizar workflow quando pagamentos mudarem
  useEffect(() => {
    onPaymentUpdate(sessionData.id, totalPago);
  }, [totalPago, sessionData.id, onPaymentUpdate]);

  const getStatusBadge = (payment: SessionPaymentExtended) => {
    const { statusPagamento, tipo } = payment;
    
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

  const getOriginIcon = (origem: string) => {
    switch (origem) {
      case 'agenda': return <Calendar className="h-3 w-3" />;
      case 'workflow_rapido': return <CreditCard className="h-3 w-3" />;
      case 'parcelado': return <Package className="h-3 w-3" />;
      default: return <DollarSign className="h-3 w-3" />;
    }
  };

  const valorTotal = sessionData.total || 0;
  const valorRestante = Math.max(0, valorTotal - totalPago);

  return (
    <div className="space-y-6">
      {/* Resumo Financeiro Expandido */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(valorTotal)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Pago</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totalPago)}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 border border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Agendado</p>
                <p className="text-lg font-bold text-yellow-600">{formatCurrency(totalPendente)}</p>
              </div>
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Restante</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(valorRestante)}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Movimentações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Histórico de Movimentações
            </CardTitle>
            <Button 
              onClick={() => setShowPaymentModal(true)}
              className="gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Adicionar Pagamento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pagamento registrado</p>
              <p className="text-sm">Clique em "Adicionar Pagamento" para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data / Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Tipo / Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments
                  .sort((a, b) => {
                    const dateA = new Date(a.dataVencimento || a.data || '1970-01-01');
                    const dateB = new Date(b.dataVencimento || b.data || '1970-01-01');
                    return dateB.getTime() - dateA.getTime();
                  })
                  .map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="space-y-1">
                          {payment.statusPagamento === 'pago' && payment.data && (
                            <div className="flex items-center gap-1 text-sm">
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              <span className="font-medium">
                                {formatDateForDisplay(payment.data)}
                              </span>
                            </div>
                          )}
                          {payment.dataVencimento && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>
                                Venc: {formatDateForDisplay(payment.dataVencimento)}
                              </span>
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
                        <span className={`font-semibold ${
                          payment.statusPagamento === 'pago' 
                            ? 'text-green-600' 
                            : 'text-yellow-600'
                        }`}>
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
                          {getOriginIcon(payment.origem)}
                          <span className="text-xs capitalize">
                            {payment.origem.replace('_', ' ')}
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
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
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
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deletePayment(payment.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modais */}
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
          onSave={(updates) => {
            editPayment(editingPayment.id, updates);
            setEditingPayment(null);
          }}
        />
      )}
    </div>
  );
}