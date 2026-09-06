import { useState, useMemo } from 'react';
import { CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard,
  Edit,
  Trash2,
  CheckCircle2,
  Calendar,
  DollarSign,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Layers,
  Zap,
} from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay, formatDateTimeForDisplay } from '@/utils/dateUtils';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { getStatusBadge, getPaymentOriginInfo, getProviderInfo } from './paymentBadges';

interface SessionPaymentsTableProps {
  payments: SessionPaymentExtended[];
  isLoading: boolean;
  isCard: boolean;
  onMarkAsPaid: (id: string) => void;
  onEditPayment: (payment: SessionPaymentExtended) => void;
  onDeletePayment: (id: string) => void;
  onRefundPayment: (payment: SessionPaymentExtended) => void;
  onAnticipatePayment: (payment: SessionPaymentExtended) => void;
}

export function SessionPaymentsTable({
  payments,
  isLoading,
  isCard,
  onMarkAsPaid,
  onEditPayment,
  onDeletePayment,
  onRefundPayment,
  onAnticipatePayment,
}: SessionPaymentsTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (cobrancaId: string) => {
    setExpandedGroups(prev => ({ ...prev, [cobrancaId]: !prev[cobrancaId] }));
  };

  const groupedPayments = useMemo(() => {
    const result: any[] = [];
    const groups = new Map<string, SessionPaymentExtended[]>();

    const validPayments = payments.filter(p => p.valor !== undefined);

    validPayments.forEach(p => {
      if (p.cobrancaId && (p.totalParcelas || 1) > 1 && p.tipo !== 'estorno') {
        if (!groups.has(p.cobrancaId)) {
          groups.set(p.cobrancaId, []);
        }
        groups.get(p.cobrancaId)!.push(p);
      } else {
        result.push(p);
      }
    });

    groups.forEach((group, cobrancaId) => {
      const first = group[0];
      const totalGroupValue = group.reduce((sum, p) => sum + p.valor, 0);
      const pagas = group.filter(p => p.statusPagamento === 'pago' || p.statusPagamento === 'antecipado').length;
      const allPaid = pagas === group.length;

      result.push({
        ...first,
        id: `group_${cobrancaId}`,
        cobrancaId: cobrancaId,
        valor: totalGroupValue,
        statusPagamento: allPaid ? 'pago' : (pagas > 0 ? 'pendente' : first.statusPagamento),
        numeroParcela: undefined,
        totalParcelas: group.length,
        isGrouped: true,
        pagasCount: pagas,
        totalCount: group.length,
        groupedItems: group.sort((a, b) => (a.numeroParcela || 0) - (b.numeroParcela || 0)), 
      });
    });

    return result.sort((a, b) => {
      const timestampA = a.createdAt || a.dataVencimento || a.data || '';
      const timestampB = b.createdAt || b.dataVencimento || b.data || '';
      return timestampB.localeCompare(timestampA);
    });
  }, [payments]);

  const renderPaymentRow = (payment: any, isChild: boolean) => (
    <TableRow key={payment.id} className={isChild ? "bg-muted/15 border-l-2 border-l-primary/60" : ""}>
      <TableCell className={isChild ? "pl-8" : ""}>
        <div className="space-y-1">
          {(payment.statusPagamento === 'pago' || payment.tipo === 'estorno' || payment.statusPagamento === 'antecipado') && (payment.createdAt || payment.data) && (
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
          (payment.statusPagamento === 'pago' || payment.statusPagamento === 'antecipado') ? 'text-green-600' : 'text-yellow-600'
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
        {(() => {
          const originInfo = getPaymentOriginInfo(payment);
          const providerInfo = getProviderInfo(payment);
          return (
            <div className="flex flex-col gap-1 items-start">
              <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-2xs font-medium border ${originInfo.badgeClass}`}>
                {originInfo.icon}
                <span>{originInfo.label}</span>
              </span>
              <div className="flex items-center gap-1 text-2xs text-muted-foreground pl-0.5">
                {providerInfo.icon}
                <span>{providerInfo.label}</span>
              </div>
            </div>
          );
        })()}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {payment.statusPagamento === 'pendente' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onMarkAsPaid(payment.id)}
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
                onClick={() => onEditPayment(payment)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDeletePayment(payment.id)}
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
                onClick={() => onEditPayment(payment)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRefundPayment(payment)}
                className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                title="Estornar pagamento"
              >
                <RotateCcw className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDeletePayment(payment.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                title="Excluir registro (lançamento manual)"
              >
                <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </>
          )}
          {payment.provedor === 'asaas' && !payment.antecipado && (payment.statusRecebimento === 'confirmado' || payment.statusPagamento === 'pago') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAnticipatePayment(payment)}
              className="h-8 w-8 p-0 text-accent-gold hover:text-accent-gold"
              title="Simular / Antecipar recebível no Asaas"
            >
              <Zap className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          )}
          {payment.statusPagamento === 'pago' && !payment.editavel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRefundPayment(payment)}
              className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
              title="Estornar pagamento"
            >
              <RotateCcw className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
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
          <p className="text-sm">Clique em "Cobrar" para enviar um link de pagamento</p>
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
              {groupedPayments.map(payment => {
                if (payment.isGrouped) {
                  const isExpanded = expandedGroups[payment.cobrancaId];
                  return (
                    <tr key={payment.id} className="contents">
                      <TableRow
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => toggleGroup(payment.cobrancaId)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            {(payment.statusPagamento === 'pago' || payment.statusPagamento === 'antecipado') && (payment.createdAt || payment.data) && (
                              <div className="flex items-center gap-1 text-sm">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                <span className="font-medium">{formatDateTimeForDisplay(payment.createdAt || payment.data)}</span>
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                              <Layers className="h-3.5 w-3.5 text-primary" />
                              <span>{payment.pagasCount}/{payment.totalCount} parcelas pagas</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${
                            (payment.statusPagamento === 'pago' || payment.statusPagamento === 'antecipado') ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {formatCurrency(payment.valor)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">PARCELADO</div>
                            {getStatusBadge(payment)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const originInfo = getPaymentOriginInfo(payment);
                            const providerInfo = getProviderInfo(payment);
                            return (
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-2xs font-medium border ${originInfo.badgeClass}`}>
                                  {originInfo.icon}
                                  <span>{originInfo.label}</span>
                                </span>
                                <div className="flex items-center gap-1 text-2xs text-muted-foreground pl-0.5">
                                  {providerInfo.icon}
                                  <span>{providerInfo.label}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroup(payment.cobrancaId);
                            }}
                            title={isExpanded ? 'Recolher parcelas' : 'Ver parcelas'}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && payment.groupedItems.map((child: any) => renderPaymentRow(child, true))}
                    </tr>
                  );
                }
                return renderPaymentRow(payment, false);
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  );
}
