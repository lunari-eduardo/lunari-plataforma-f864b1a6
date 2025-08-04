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
    
    // Carregar dados diretamente do localStorage do workflow
    const workflowItems = JSON.parse(localStorage.getItem('lunari_workflow_items') || '[]');
    
    // Filtrar por clienteId
    return workflowItems.filter((item: any) => item.clienteId === cliente.id);
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
                    {item.desconto > 0 && (
                      <div>Desconto: {item.desconto}%</div>
                    )}
                    {item.valorFotoExtra > 0 && (
                      <div>Fotos extras: {item.qtdFotoExtra}x - {formatCurrency(item.valorFotoExtra)}</div>
                    )}
                    {item.produtosList && item.produtosList.length > 0 && (
                      <div>
                        Produtos: {item.produtosList.map((p: any) => 
                          `${p.quantidade}x ${p.nome} (${formatCurrency(p.valorUnitario)})`
                        ).join(', ')}
                      </div>
                    )}
                    {item.valorAdicional > 0 && (
                      <div>Adicional: {formatCurrency(item.valorAdicional)}</div>
                    )}
                    {item.detalhes && (
                      <div>Obs: {item.detalhes}</div>
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
                  <div className="font-medium">Total: {formatCurrency(item.total || 0)}</div>
                  <div className="text-sm text-green-600">Pago: {formatCurrency(item.valorPago || 0)}</div>
                  <div className="text-sm text-orange-600">Restante: {formatCurrency((item.total || 0) - (item.valorPago || 0))}</div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}