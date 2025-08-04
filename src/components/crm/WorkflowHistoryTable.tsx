import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { Cliente } from '@/types/orcamentos';

interface WorkflowHistoryTableProps {
  cliente: Cliente;
}

export function WorkflowHistoryTable({ cliente }: WorkflowHistoryTableProps) {
  const workflowData = useMemo(() => {
    if (!cliente) return [];
    
    // FONTE ÚNICA: workflow_sessions com dados corrigidos E deduplicados
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    
    // Filtrar sessões do cliente (by clienteId E nome como fallback)
    const clientSessions = workflowSessions
      .filter((session: any) => {
        const matchByClienteId = session.clienteId === cliente.id;
        const matchByName = !session.clienteId && 
          session.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
        return matchByClienteId || matchByName;
      })
      .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
    
    // DEDUPLICAÇÃO FINAL por sessionId (caso ainda existam duplicatas)
    const sessionMap = new Map();
    clientSessions.forEach((session: any) => {
      const sessionKey = session.sessionId || session.id;
      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, session);
      }
    });
    
    return Array.from(sessionMap.values())
      .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [cliente]);

  const getStatusBadge = (status: string) => {
    const colors = {
      'Agendado': 'bg-blue-100 text-blue-800',
      'Concluído': 'bg-green-100 text-green-800',
      'Cancelado': 'bg-red-100 text-red-800',
      'Em Andamento': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (workflowData.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum histórico encontrado</h3>
        <p className="text-muted-foreground">
          Este cliente ainda não possui trabalhos registrados no workflow.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflowData.map((item: any) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {formatDateForDisplay(item.data)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="border-blue-500 text-blue-600">
                  ⚡ Trabalho
                </Badge>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{item.pacote || item.descricao}</div>
                  {item.categoria && (
                    <div className="text-sm text-muted-foreground">{item.categoria}</div>
                  )}
                  
                  {/* Detalhes completos do workflow */}
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {/* Valor do pacote */}
                    <div className="font-medium">Valor base: {formatCurrency(item.valorPacote || 0)}</div>
                    
                    {/* Desconto */}
                    {(item.desconto > 0) && (
                      <div className="text-red-600">
                        Desconto: {typeof item.desconto === 'number' ? `${item.desconto}%` : formatCurrency(parseFloat(item.desconto) || 0)}
                      </div>
                    )}
                    
                    {/* Fotos extras */}
                    {(item.qtdFotoExtra > 0 || item.valorTotalFotoExtra > 0) && (
                      <div className="text-blue-600">
                        Fotos extras: {item.qtdFotoExtra || 0}x - {formatCurrency(item.valorFotoExtra || 0)} cada = {formatCurrency(item.valorTotalFotoExtra || 0)}
                      </div>
                    )}
                    
                    {/* Produtos */}
                    {item.produtosList && item.produtosList.length > 0 && (
                      <div className="text-purple-600">
                        <div className="font-medium">Produtos:</div>
                        {item.produtosList.map((p: any, index: number) => (
                          <div key={index} className="ml-2">
                            • {p.quantidade}x {p.nome} 
                            {p.tipo === 'manual' && ` - ${formatCurrency(p.valorUnitario)} cada`}
                            {p.tipo === 'incluso' && ' (incluso)'}
                          </div>
                        ))}
                        {item.valorTotalProduto > 0 && (
                          <div className="ml-2 font-medium">Total produtos: {formatCurrency(item.valorTotalProduto)}</div>
                        )}
                      </div>
                    )}
                    
                    {/* Valor adicional */}
                    {item.valorAdicional > 0 && (
                      <div className="text-green-600">Adicional: {formatCurrency(item.valorAdicional)}</div>
                    )}
                    
                    {/* Pagamentos */}
                    {item.pagamentos && item.pagamentos.length > 0 && (
                      <div className="text-green-700">
                        <div className="font-medium">Pagamentos:</div>
                        {item.pagamentos.map((pag: any, index: number) => (
                          <div key={index} className="ml-2">
                            • {formatCurrency(pag.valor)} em {new Date(pag.data).toLocaleDateString('pt-BR')}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Observações */}
                    {item.detalhes && (
                      <div className="text-gray-600 italic">Obs: {item.detalhes}</div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getStatusBadge(item.status)}>
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="space-y-1">
                  <div className="font-bold text-lg">Total: {formatCurrency(item.total || 0)}</div>
                  <div className="text-sm text-green-600 font-medium">✅ Pago: {formatCurrency(item.valorPago || 0)}</div>
                  <div className={`text-sm font-medium ${
                    ((item.total || 0) - (item.valorPago || 0)) > 0 
                      ? 'text-orange-600' 
                      : 'text-gray-500'
                  }`}>
                    {((item.total || 0) - (item.valorPago || 0)) > 0 ? '⏳' : '✅'} 
                    Restante: {formatCurrency((item.total || 0) - (item.valorPago || 0))}
                  </div>
                  
                  {/* Percentual pago */}
                  <div className="text-xs text-muted-foreground">
                    {(item.total || 0) > 0 
                      ? `${(((item.valorPago || 0) / (item.total || 0)) * 100).toFixed(0)}% pago`
                      : 'N/A'
                    }
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}