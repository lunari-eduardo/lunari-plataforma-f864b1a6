import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { Cliente } from '@/types/orcamentos';
import { useAppContext } from '@/contexts/AppContext';
import { ProjetoService } from '@/services/ProjetoService';

interface WorkflowHistoryTableProps {
  cliente: Cliente;
}

export function WorkflowHistoryTable({ cliente }: WorkflowHistoryTableProps) {
  // NOVA ARQUITETURA: Usar projetos como fonte única de verdade
  const workflowData = useMemo(() => {
    if (!cliente) return [];
    
    // BUSCAR PROJETOS POR CLIENTE
    const projetos = ProjetoService.buscarPorCliente(cliente.id);
    
    console.log('📊 HISTÓRICO PROJETOS:', {
      clienteId: cliente.id,
      projetos: projetos.length,
      fonte: 'ProjetoService'
    });
    
    // Ordenar por data mais recente primeiro
    return projetos
      .sort((a, b) => new Date(b.dataAgendada).getTime() - new Date(a.dataAgendada).getTime());
  }, [cliente]);

  const getStatusBadge = (status: string) => {
    const colors = {
      'agendado': 'bg-blue-100 text-blue-800',
      'em_andamento': 'bg-yellow-100 text-yellow-800',
      'finalizado': 'bg-green-100 text-green-800',
      'cancelado': 'bg-red-100 text-red-800',
      // Compatibilidade com status antigos
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
          {workflowData.map((projeto) => (
            <TableRow key={projeto.projectId}>
              <TableCell className="font-medium">
                {formatDateForDisplay(projeto.dataAgendada.toISOString().split('T')[0])}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="border-blue-500 text-blue-600">
                  ⚡ Projeto
                </Badge>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{projeto.descricao}</div>
                  {projeto.categoria && (
                    <div className="text-sm text-muted-foreground">{projeto.categoria}</div>
                  )}
                  
                  {/* Detalhes completos do projeto */}
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {/* Pacote */}
                    <div className="font-medium">Pacote: {projeto.pacote}</div>
                    
                    {/* Valor do pacote */}
                    <div className="font-medium">Valor base: {formatCurrency(projeto.valorPacote)}</div>
                    
                    {/* Desconto */}
                    {projeto.desconto > 0 && (
                      <div className="text-red-600">
                        Desconto: {formatCurrency(projeto.desconto)}
                      </div>
                    )}
                    
                    {/* Fotos extras */}
                    {(projeto.qtdFotosExtra > 0 || projeto.valorTotalFotosExtra > 0) && (
                      <div className="text-blue-600">
                        Fotos extras: {projeto.qtdFotosExtra}x - {formatCurrency(projeto.valorFotoExtra)} cada = {formatCurrency(projeto.valorTotalFotosExtra)}
                      </div>
                    )}
                    
                    {/* Produtos */}
                    {projeto.produtosList && projeto.produtosList.length > 0 && (
                      <div className="text-purple-600">
                        <div className="font-medium">Produtos:</div>
                        {projeto.produtosList.map((p, index) => (
                          <div key={index} className="ml-2">
                            • {p.quantidade}x {p.nome} 
                            {p.tipo === 'manual' && ` - ${formatCurrency(p.valorUnitario)} cada`}
                            {p.tipo === 'incluso' && ' (incluso)'}
                          </div>
                        ))}
                        {projeto.valorProdutos > 0 && (
                          <div className="ml-2 font-medium">Total produtos: {formatCurrency(projeto.valorProdutos)}</div>
                        )}
                      </div>
                    )}
                    
                    {/* Valor adicional */}
                    {projeto.valorAdicional > 0 && (
                      <div className="text-green-600">Adicional: {formatCurrency(projeto.valorAdicional)}</div>
                    )}
                    
                    {/* Pagamentos */}
                    {projeto.pagamentos && projeto.pagamentos.length > 0 && (
                      <div className="text-green-700">
                        <div className="font-medium">Pagamentos:</div>
                        {projeto.pagamentos.map((pag, index) => (
                          <div key={index} className="ml-2">
                            • {formatCurrency(pag.valor)} em {new Date(pag.data).toLocaleDateString('pt-BR')}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Observações */}
                    {projeto.detalhes && (
                      <div className="text-gray-600 italic">Obs: {projeto.detalhes}</div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getStatusBadge(projeto.status)}>
                  {projeto.status === 'agendado' ? 'Agendado' : 
                   projeto.status === 'em_andamento' ? 'Em Andamento' :
                   projeto.status === 'finalizado' ? 'Finalizado' : 
                   projeto.status === 'cancelado' ? 'Cancelado' : projeto.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="space-y-1">
                  <div className="font-bold text-lg">Total: {formatCurrency(projeto.total)}</div>
                  <div className="text-sm text-green-600 font-medium">✅ Pago: {formatCurrency(projeto.valorPago)}</div>
                  <div className={`text-sm font-medium ${
                    projeto.restante > 0 
                      ? 'text-orange-600' 
                      : 'text-gray-500'
                  }`}>
                    {projeto.restante > 0 ? '⏳' : '✅'} 
                    Restante: {formatCurrency(projeto.restante)}
                  </div>
                  
                  {/* Percentual pago */}
                  <div className="text-xs text-muted-foreground">
                    {projeto.total > 0 
                      ? `${((projeto.valorPago / projeto.total) * 100).toFixed(0)}% pago`
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