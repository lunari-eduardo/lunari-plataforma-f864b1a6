import { useState, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Clock, DollarSign, TrendingUp, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useClientReceivables } from '@/hooks/useClientReceivables';
import { formatCurrency } from '@/utils/financialUtils';
import { convertISODateToBR } from '@/utils/dateUtils';
import { PaymentInstallment } from '@/types/receivables';
import { AppContext } from '@/contexts/AppContext';

export default function ReceivablesTab() {
  const { obterResumo, installments, marcarComoPago, paymentPlans } = useClientReceivables();
  const { clientes } = useContext(AppContext);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'pago'>('todos');
  
  const resumo = obterResumo();

  const installmentsFiltradas = installments.filter(installment => {
    if (filtroStatus === 'todos') return true;
    return installment.status === filtroStatus;
  });

  const getStatusBadge = (status: PaymentInstallment['status']) => {
    if (status === 'pago') {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
  };

  const getClienteName = (installment: PaymentInstallment) => {
    const plan = paymentPlans.find(p => p.id === installment.paymentPlanId);
    if (!plan) return 'Cliente não encontrado';
    
    const cliente = clientes.find(c => c.id === plan.clienteId);
    return cliente?.nome || 'Cliente removido';
  };

  const getUrgencyBadge = (dataVencimento: string) => {
    const hoje = new Date().toISOString().split('T')[0];
    const vencimento = new Date(dataVencimento);
    const agora = new Date();
    
    if (dataVencimento < hoje) {
      return <Badge variant="destructive" className="text-xs">Em Atraso</Badge>;
    }
    
    if (dataVencimento === hoje) {
      return <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200 text-xs">Vence Hoje</Badge>;
    }
    
    const diffTime = vencimento.getTime() - agora.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 3) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 text-xs">Próximo</Badge>;
    }
    
    return null;
  };

  const handleMarcarComoPago = async (installmentId: string) => {
    await marcarComoPago(installmentId);
  };

  return (
    <div className="space-y-6">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-lunar-textSecondary">
              A Receber (Mês Atual)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(resumo.mesAtual.totalAReceber)}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              {resumo.mesAtual.quantidadeParcelas} parcelas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-lunar-textSecondary">
              Em Atraso
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(resumo.mesAtual.totalEmAtraso)}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              {resumo.mesAtual.quantidadeEmAtraso} parcelas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-lunar-textSecondary">
              Quitado (Mês Atual)
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(resumo.mesAtual.totalQuitado)}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              Pagamentos recebidos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-lunar-textSecondary">
              Próximo Mês
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(resumo.proximoMes.totalAReceber)}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              {resumo.proximoMes.quantidadeParcelas} parcelas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vencimentos Críticos */}
      {(resumo.vencimentosHoje.length > 0 || resumo.vencimentosProximos.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {resumo.vencimentosHoje.length > 0 && (
            <Card className="bg-red-50 border border-red-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-red-800 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Vencimentos Hoje ({resumo.vencimentosHoje.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {resumo.vencimentosHoje.map((installment) => (
                    <div key={installment.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div>
                        <div className="font-medium text-sm text-lunar-text">
                          Parcela {installment.numeroParcela}
                        </div>
                        <div className="text-lg font-bold text-red-600">
                          {formatCurrency(installment.valor)}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => handleMarcarComoPago(installment.id)}
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

          {resumo.vencimentosProximos.length > 0 && (
            <Card className="bg-orange-50 border border-orange-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-orange-800 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Próximos Vencimentos ({resumo.vencimentosProximos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {resumo.vencimentosProximos.slice(0, 3).map((installment) => (
                    <div key={installment.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div>
                        <div className="font-medium text-sm text-lunar-text">
                          Parcela {installment.numeroParcela}
                        </div>
                        <div className="text-sm text-lunar-textSecondary">
                          Vence em {convertISODateToBR(installment.dataVencimento)}
                        </div>
                        <div className="text-lg font-bold text-orange-600">
                          {formatCurrency(installment.valor)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tabela de Controle */}
      <Card className="bg-card border border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-lunar-text">
              Controle de Parcelas
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={filtroStatus === 'todos' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroStatus('todos')}
              >
                Todas
              </Button>
              <Button
                variant={filtroStatus === 'pendente' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroStatus('pendente')}
              >
                Pendentes
              </Button>
              <Button
                variant={filtroStatus === 'pago' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroStatus('pago')}
              >
                Pagas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installmentsFiltradas.map((installment) => (
                <TableRow key={installment.id}>
                  <TableCell>
                    <div className="font-medium text-lunar-text">
                      {getClienteName(installment)}
                    </div>
                    <div className="text-sm text-lunar-textSecondary">
                      ID: {installment.paymentPlanId.slice(-8)}
                    </div>
                  </TableCell>
                   <TableCell>
                     <div>
                       <div className="font-medium">
                         {installment.numeroParcela === 0 
                           ? (installment.observacoes === 'Entrada do agendamento' ? 'Entrada' : 'Pagamento')
                           : `Parcela ${installment.numeroParcela}/${paymentPlans.find(p => p.id === installment.paymentPlanId)?.numeroParcelas || 1}`}
                       </div>
                       <div className="text-sm text-muted-foreground">
                         Plano: {paymentPlans.find(p => p.id === installment.paymentPlanId)?.formaPagamento === 'avista' ? 'À vista' : `${paymentPlans.find(p => p.id === installment.paymentPlanId)?.numeroParcelas}x`}
                       </div>
                     </div>
                   </TableCell>
                  <TableCell>
                    <div className="font-semibold">
                      {formatCurrency(installment.valor)}
                    </div>
                  </TableCell>
                  <TableCell>
                     <div className="flex items-center gap-2">
                       <span>
                         {convertISODateToBR(installment.dataVencimento)}
                       </span>
                       {getUrgencyBadge(installment.dataVencimento)}
                     </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(installment.status)}
                  </TableCell>
                  <TableCell>
                    {installment.status === 'pendente' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarcarComoPago(installment.id)}
                      >
                        Marcar como Pago
                      </Button>
                    )}
                    {installment.status === 'pago' && installment.dataPagamento && (
                      <div className="text-sm text-green-600">
                        Pago em {convertISODateToBR(installment.dataPagamento)}
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