import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { useAppContext } from '@/contexts/AppContext';

interface ClientPaymentHistoryProps {
  clienteId: string;
  clienteNome: string;
}

export function ClientPaymentHistory({ clienteId, clienteNome }: ClientPaymentHistoryProps) {
  const { workflowItemsAll } = useAppContext();
  
  // Buscar sessões do workflow relacionadas ao cliente
  const sessionesCliente = workflowItemsAll.filter(session => session.clienteId === clienteId);
  
  // Calcular dados dos pagamentos a partir do workflow
  const calcularDadosFinanceiros = () => {
    let totalContratado = 0;
    let totalPago = 0;
    let totalPendente = 0;
    let pagamentosHistorico: any[] = [];
    
    sessionesCliente.forEach(session => {
      const valorTotal = session.total || 0;
      const valorPagoStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
      const valorPago = parseFloat(valorPagoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const valorPendente = Math.max(0, valorTotal - valorPago);
      
      totalContratado += valorTotal;
      totalPago += valorPago;
      totalPendente += valorPendente;
      
      // Adicionar pagamentos do histórico da sessão
      if (session.pagamentos && session.pagamentos.length > 0) {
        session.pagamentos.forEach(pagamento => {
          pagamentosHistorico.push({
            id: pagamento.id,
            sessionId: session.id,
            sessionData: session.data,
            sessionDescricao: session.descricao,
            valor: pagamento.valor,
            dataPagamento: pagamento.data,
            status: 'pago' as const
          });
        });
      }
    });
    
    return {
      totalContratado,
      totalPago,
      totalPendente,
      pagamentosHistorico: pagamentosHistorico.sort((a, b) => 
        new Date(b.dataPagamento).getTime() - new Date(a.dataPagamento).getTime()
      )
    };
  };

  const dadosFinanceiros = calcularDadosFinanceiros();

  const calcularScorePagamento = () => {
    if (sessionesCliente.length === 0) return 'Novo Cliente';
    
    const sessoesPagas = sessionesCliente.filter(s => {
      const valorPagoStr = typeof s.valorPago === 'string' ? s.valorPago : String(s.valorPago || '0');
      const valorPago = parseFloat(valorPagoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      return valorPago > 0;
    });
    
    const percentualPagas = (sessoesPagas.length / sessionesCliente.length) * 100;
    
    if (percentualPagas === 100) return 'Excelente';
    if (percentualPagas >= 80) return 'Bom';
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

  if (sessionesCliente.length === 0) {
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
            <p>Nenhuma sessão encontrada</p>
            <p className="text-sm">Crie sessões no Workflow para começar o controle financeiro</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
              {formatCurrency(dadosFinanceiros.totalContratado)}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              {sessionesCliente.length} sessão(ões)
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
              {formatCurrency(dadosFinanceiros.totalPago)}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              {dadosFinanceiros.pagamentosHistorico.length} pagamento(s)
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
              {formatCurrency(dadosFinanceiros.totalPendente)}
            </div>
            <p className="text-xs text-lunar-textSecondary">
              A receber
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

      {/* Tabela de Histórico */}
      <Card className="bg-card border border-border">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-lunar-text">
            Histórico de Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dadosFinanceiros.pagamentosHistorico.length === 0 ? (
            <div className="text-center py-8 text-lunar-textSecondary">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pagamento registrado</p>
              <p className="text-sm">Os pagamentos aparecerão aqui quando forem adicionados no Workflow</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sessão</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosFinanceiros.pagamentosHistorico.map((pagamento) => (
                  <TableRow key={pagamento.id}>
                    <TableCell>
                      <div className="font-medium">
                        {pagamento.sessionDescricao || 'Sessão sem descrição'}
                      </div>
                      <div className="text-sm text-lunar-textSecondary">
                        {formatDateForDisplay(pagamento.sessionData)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-green-600">
                        {formatCurrency(pagamento.valor)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-lunar-textSecondary" />
                        <span>
                          {formatDateForDisplay(pagamento.dataPagamento)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                        Pago
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}