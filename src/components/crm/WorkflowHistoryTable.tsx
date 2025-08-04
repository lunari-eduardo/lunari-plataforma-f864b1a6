import { useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { History, Calendar, DollarSign, Package, CreditCard } from "lucide-react";
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
    
    // Corrigir cálculos de cada sessão
    return Array.from(sessionMap.values())
      .map((session: any) => {
        const valorPacote = parseFloat(session.valorPacote) || 0;
        const desconto = parseFloat(session.desconto) || 0;
        const valorTotalFotoExtra = parseFloat(session.valorTotalFotoExtra) || 0;
        const valorTotalProduto = parseFloat(session.valorTotalProduto) || 0;
        const valorAdicional = parseFloat(session.valorAdicional) || 0;
        
        // CÁLCULO CORRETO DO TOTAL
        const totalCalculado = valorPacote + valorTotalFotoExtra + valorTotalProduto + valorAdicional - desconto;
        
        return {
          ...session,
          total: totalCalculado,
          valorPago: parseFloat(session.valorPago) || 0,
          restante: totalCalculado - (parseFloat(session.valorPago) || 0)
        };
      })
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
    <div className="space-y-4">
      <Accordion type="single" collapsible className="w-full">
        {workflowData.map((item: any) => (
          <AccordionItem key={item.id} value={item.id} className="border rounded-lg mb-4">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center justify-between w-full mr-4">
                {/* Header do Card - Informações Principais */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatDateForDisplay(item.data)}</span>
                  </div>
                  
                  <Badge variant="outline" className="border-blue-500 text-blue-600">
                    <Package className="h-3 w-3 mr-1" />
                    Trabalho
                  </Badge>
                  
                  <Badge className={getStatusBadge(item.status)}>
                    {item.status}
                  </Badge>
                </div>

                {/* Valor Total no Header */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-medium">{item.pacote || item.descricao}</div>
                    <div className="text-sm text-muted-foreground">{item.categoria}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold text-lg text-primary">{formatCurrency(item.total || 0)}</div>
                    <div className="text-sm text-muted-foreground">
                      {(item.total || 0) > 0 
                        ? `${(((item.valorPago || 0) / (item.total || 0)) * 100).toFixed(0)}% pago`
                        : 'N/A'
                      }
                    </div>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent className="px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* SEÇÃO: Composição do Valor */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 font-semibold text-blue-600 border-b pb-2">
                    <DollarSign className="h-4 w-4" />
                    Composição do Valor
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Valor base:</span>
                      <span className="font-medium text-blue-600">{formatCurrency(item.valorPacote || 0)}</span>
                    </div>
                    
                    {item.desconto > 0 && (
                      <div className="flex justify-between">
                        <span>Desconto:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(item.desconto || 0)}</span>
                      </div>
                    )}
                    
                    {item.valorTotalFotoExtra > 0 && (
                      <div className="flex justify-between">
                        <span>Fotos extras ({item.qtdFotoExtra || 0}x):</span>
                        <span className="font-medium text-blue-600">+{formatCurrency(item.valorTotalFotoExtra || 0)}</span>
                      </div>
                    )}
                    
                    {item.valorTotalProduto > 0 && (
                      <div className="flex justify-between">
                        <span>Produtos:</span>
                        <span className="font-medium text-blue-600">+{formatCurrency(item.valorTotalProduto || 0)}</span>
                      </div>
                    )}
                    
                    {item.valorAdicional > 0 && (
                      <div className="flex justify-between">
                        <span>Adicional:</span>
                        <span className="font-medium text-blue-600">+{formatCurrency(item.valorAdicional || 0)}</span>
                      </div>
                    )}
                    
                    <div className="border-t pt-2 mt-3">
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span className="text-primary">{formatCurrency(item.total || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO: Situação Financeira */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 font-semibold text-green-600 border-b pb-2">
                    <CreditCard className="h-4 w-4" />
                    Situação Financeira
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-green-700 font-medium">✅ Valor Pago:</span>
                        <span className="font-bold text-green-800">{formatCurrency(item.valorPago || 0)}</span>
                      </div>
                    </div>
                    
                    <div className={`p-3 rounded-lg ${
                      item.restante > 0 ? 'bg-orange-50' : 'bg-gray-50'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className={`font-medium ${
                          item.restante > 0 ? 'text-orange-700' : 'text-gray-700'
                        }`}>
                          {item.restante > 0 ? '⏳' : '✅'} Restante:
                        </span>
                        <span className={`font-bold ${
                          item.restante > 0 ? 'text-orange-800' : 'text-gray-800'
                        }`}>
                          {formatCurrency(item.restante || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Histórico de Pagamentos */}
                  {item.pagamentos && item.pagamentos.length > 0 && (
                    <div className="mt-4">
                      <div className="font-medium text-sm mb-2">Histórico de Pagamentos:</div>
                      <div className="space-y-1">
                        {item.pagamentos.map((pag: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                            <span>{new Date(pag.data).toLocaleDateString('pt-BR')}</span>
                            <span className="font-medium">{formatCurrency(pag.valor)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SEÇÃO: Detalhes dos Produtos */}
              {item.produtosList && item.produtosList.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <div className="font-semibold text-purple-600 mb-3">📦 Produtos Inclusos:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {item.produtosList.map((p: any, index: number) => (
                      <div key={index} className="bg-purple-50 p-3 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{p.quantidade}x {p.nome}</span>
                          <span className="text-sm">
                            {p.tipo === 'manual' && formatCurrency(p.valorUnitario)}
                            {p.tipo === 'incluso' && '(incluso)'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações */}
              {item.detalhes && (
                <div className="mt-4 pt-4 border-t">
                  <div className="font-medium text-sm mb-2">📝 Observações:</div>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm italic text-gray-700">
                    {item.detalhes}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}