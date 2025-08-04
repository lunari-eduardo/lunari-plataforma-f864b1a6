import { useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { Cliente } from '@/types/orcamentos';

interface WorkflowHistoryTableProps {
  cliente: Cliente;
}

export function WorkflowHistoryTable({ cliente }: WorkflowHistoryTableProps) {
  const { workflowItems } = useAppContext();

  // Filtrar dados do workflow para este cliente (APENAS por clienteId)
  const clienteWorkflowData = useMemo(() => {
    const dados = workflowItems.filter(item => item.clienteId === cliente.id);
    
    console.log('📋 HISTÓRICO WORKFLOW COMPLETO:', {
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      totalItens: dados.length,
      dadosDetalhados: dados.map(item => ({
        id: item.id,
        nome: item.nome,
        pacote: item.pacote,
        total: item.total,
        valorPago: item.valorPago,
        clienteId: item.clienteId
      }))
    });

    return dados.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [workflowItems, cliente.id]);

  if (clienteWorkflowData.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Nenhum histórico encontrado para este cliente.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      'Agendado': 'bg-blue-100 text-blue-800',
      'Concluído': 'bg-green-100 text-green-800', 
      'Cancelado': 'bg-red-100 text-red-800',
      'Em Andamento': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Pacote</TableHead>
            <TableHead>Desconto</TableHead>
            <TableHead>Foto Extra</TableHead>
            <TableHead>Produtos</TableHead>
            <TableHead>Adicional</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Pago</TableHead>
            <TableHead className="text-right">Restante</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clienteWorkflowData.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {formatDateForDisplay(item.data)}
              </TableCell>
              
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{item.pacote || '-'}</span>
                  {item.categoria && (
                    <span className="text-xs text-muted-foreground">{item.categoria}</span>
                  )}
                </div>
              </TableCell>
              
              <TableCell>
                {item.desconto > 0 ? (
                  <span className="text-green-600">
                    -{item.desconto}%
                  </span>
                ) : '-'}
              </TableCell>
              
              <TableCell>
                {item.qtdFotoExtra > 0 ? (
                  <div className="flex flex-col text-xs">
                    <span>{item.qtdFotoExtra} fotos</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(item.valorTotalFotoExtra)}
                    </span>
                  </div>
                ) : '-'}
              </TableCell>
              
              <TableCell>
                {item.produtosList && item.produtosList.length > 0 ? (
                  <div className="flex flex-col text-xs">
                    {item.produtosList.map((produto, idx) => (
                      <div key={idx} className="mb-1">
                        <span>{produto.quantidade}x {produto.nome}</span>
                        <span className="text-muted-foreground ml-1">
                          ({formatCurrency(produto.quantidade * produto.valorUnitario)})
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  item.qtdProduto > 0 ? (
                    <div className="flex flex-col text-xs">
                      <span>{item.qtdProduto}x {item.produto}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(item.valorTotalProduto)}
                      </span>
                    </div>
                  ) : '-'
                )}
              </TableCell>
              
              <TableCell>
                {item.valorAdicional > 0 ? (
                  <div className="flex flex-col text-xs">
                    <span>{formatCurrency(item.valorAdicional)}</span>
                    {item.detalhes && (
                      <span className="text-muted-foreground" title={item.detalhes}>
                        {item.detalhes.substring(0, 20)}...
                      </span>
                    )}
                  </div>
                ) : '-'}
              </TableCell>
              
              <TableCell>
                <Badge className={getStatusBadge(item.status)}>
                  {item.status}
                </Badge>
              </TableCell>
              
              <TableCell className="text-right font-medium">
                {formatCurrency(item.total)}
              </TableCell>
              
              <TableCell className="text-right text-green-600">
                {formatCurrency(item.valorPago)}
              </TableCell>
              
              <TableCell className="text-right">
                <span className={item.restante > 0 ? 'text-orange-600' : 'text-green-600'}>
                  {formatCurrency(item.restante)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}