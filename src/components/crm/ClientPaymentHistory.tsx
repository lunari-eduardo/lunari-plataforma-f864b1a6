import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useClientReceivables } from '@/hooks/useClientReceivables';
import { formatCurrency } from '@/utils/financialUtils';
import { getCurrentDateString, formatDateForDisplay } from '@/utils/dateUtils';
import { PaymentInstallment } from '@/types/receivables';

interface ClientPaymentHistoryProps {
  clienteId: string;
  clienteNome: string;
}

export function ClientPaymentHistory({ clienteId, clienteNome }: ClientPaymentHistoryProps) {
  const { obterPlanosPorCliente, obterParcelasPorPlano, marcarComoPago } = useClientReceivables();
  
  const planosCliente = obterPlanosPorCliente(clienteId);
  const todasParcelas = planosCliente.flatMap(plano => 
    obterParcelasPorPlano(plano.id).map(parcela => ({
      ...parcela,
      plano
    }))
  );

  const hoje = getCurrentDateString();
  const parcelasEmAtraso = todasParcelas.filter(p => p.status === 'pendente' && p.dataVencimento < hoje);
  const parcelasPendentes = todasParcelas.filter(p => p.status === 'pendente');
  const parcelasPagas = todasParcelas.filter(p => p.status === 'pago');

  const getTotalParcelas = (paymentPlanId: string): number => {
    const plano = planosCliente.find(p => p.id === paymentPlanId);
    return plano?.numeroParcelas || 1;
  };

  const getStatusBadge = (status: PaymentInstallment['status'], dataVencimento: string) => {
    if (status === 'pago') {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
    }
    
    if (dataVencimento < hoje) {
      return <Badge variant="destructive">Em Atraso</Badge>;
    }
    
    if (dataVencimento === hoje) {
      return <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">Vence Hoje</Badge>;
    }
    
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
  };

  const calcularScorePagamento = () => {
    if (todasParcelas.length === 0) return 'Novo Cliente';
    
    const percentualPagas = (parcelasPagas.length / todasParcelas.length) * 100;
    const temAtraso = parcelasEmAtraso.length > 0;
    
    if (percentualPagas === 100) return 'Excelente';
    if (percentualPagas >= 80 && !temAtraso) return 'Bom';
    if (percentualPagas >= 60) return 'Regular';
    return 'Ruim';
  };

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'Excelente': return 'text-green-600';
      case 'Bom': return 'text-blue-600';
      case 'Regular': return 'text-yellow-600';
      case 'Ruim': return 'text-red-600';
      default: return 'text-lunar-textSecondary';
    }
  };

  if (planosCliente.length === 0) {
    return (
      <Card className="bg-card border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-lunar-text flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Histórico Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-lunar-textSecondary">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum plano de pagamento configurado</p>
            <p className="text-sm">Configure pagamentos no Workflow para começar o controle</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalValorPlanos = planosCliente.reduce((sum, plano) => sum + plano.valorTotal, 0);
  const totalPago = parcelasPagas.reduce((sum, parcela) => sum + parcela.valor, 0);
  const totalPendente = parcelasPendentes.reduce((sum, parcela) => sum + parcela.valor, 0);

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-lunar-textSecondary">
              Total Contratado
            </CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalValorPlanos)}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              {planosCliente.length} plano(s)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-lunar-textSecondary">
              Total Pago
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalPago)}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              {parcelasPagas.length} parcela(s)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-lunar-textSecondary">
              Pendente
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(totalPendente)}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              {parcelasPendentes.length} parcela(s)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-lunar-textSecondary">
              Score Pagamento
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(calcularScorePagamento())}`}>
              {calcularScorePagamento()}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              Baseado no histórico
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Pagamentos em Atraso */}
      {parcelasEmAtraso.length > 0 && (
        <Card className="bg-red-50 border border-red-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Pagamentos em Atraso ({parcelasEmAtraso.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {parcelasEmAtraso.map((parcela) => (
                <div key={parcela.id} className="flex items-center justify-between p-3 bg-white rounded border border-red-200">
                  <div>
                    <div className="font-medium text-sm text-lunar-text">
                      Parcela {parcela.numeroParcela} - Plano {parcela.plano.formaPagamento}
                    </div>
                    <div className="text-sm text-red-600">
                      Venceu em {formatDateForDisplay(parcela.dataVencimento)}
                    </div>
                    <div className="text-lg font-bold text-red-600">
                      {formatCurrency(parcela.valor)}
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => marcarComoPago(parcela.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Marcar como Pago
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Histórico */}
      <Card className="bg-card border border-border">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-lunar-text">
            Histórico de Parcelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano/Parcela</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todasParcelas
                .sort((a, b) => new Date(b.dataVencimento).getTime() - new Date(a.dataVencimento).getTime())
                .map((parcela) => (
                <TableRow key={parcela.id}>
                  <TableCell>
                    <div className="font-medium">
                      {parcela.numeroParcela === 0 ? (
                        parcela.observacoes === 'Entrada do agendamento' ? 'Entrada' :
                        parcela.observacoes === 'Pagamento rápido' ? 'Pagamento' :
                        'Pagamento'
                      ) : (
                        `Parcela ${parcela.numeroParcela}/${getTotalParcelas(parcela.paymentPlanId)}`
                      )}
                    </div>
                    <div className="text-sm text-lunar-textSecondary">
                      {formatCurrency(parcela.plano.valorTotal)} total
                    </div>
                    {parcela.observacoes && parcela.numeroParcela > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {parcela.observacoes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">
                      {formatCurrency(parcela.valor)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-lunar-textSecondary" />
                      <span>
                        {formatDateForDisplay(parcela.dataVencimento)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(parcela.status, parcela.dataVencimento)}
                  </TableCell>
                  <TableCell>
                    {parcela.status === 'pendente' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => marcarComoPago(parcela.id)}
                      >
                        Marcar como Pago
                      </Button>
                    )}
                    {parcela.status === 'pago' && parcela.dataPagamento && (
                      <div className="text-sm text-green-600">
                        Pago em {formatDateForDisplay(parcela.dataPagamento)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}