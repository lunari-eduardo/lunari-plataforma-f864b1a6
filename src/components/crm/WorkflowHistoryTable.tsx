import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { History, Calendar, DollarSign, Package } from "lucide-react";
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { ClienteCompleto } from '@/types/cliente-supabase';
import { SessionPaymentHistory } from './SessionPaymentHistory';
import { useClientSessionsRealtime } from '@/hooks/useClientSessionsRealtime';
import { useWorkflowRealtime } from '@/hooks/useWorkflowRealtime';

interface WorkflowHistoryTableProps {
  cliente: ClienteCompleto;
}

export function WorkflowHistoryTable({ cliente }: WorkflowHistoryTableProps) {
  // Buscar sessões diretamente do Supabase
  const { sessions, loading } = useClientSessionsRealtime(cliente.id);
  const { updateSession } = useWorkflowRealtime();
  const getStatusBadge = (status: string) => {
    const colors = {
      'agendado': 'bg-blue-100 text-blue-800',
      'concluido': 'bg-green-100 text-green-800',
      'cancelado': 'bg-red-100 text-red-800',
      'em_andamento': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status as keyof typeof colors] || 'bg-muted text-foreground';
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Carregando histórico...</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return <div className="text-center py-8">
        <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum histórico encontrado</h3>
        <p className="text-muted-foreground">
          Este cliente ainda não possui trabalhos registrados no workflow.
        </p>
      </div>;
  }
  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="w-full">
        {sessions.map((item) => (
          <AccordionItem 
            key={item.id} 
            value={item.id} 
            className="border border-lunar-border rounded-lg mb-4 bg-lunar-surface shadow-lunar-sm hover:shadow-lunar-md transition-all duration-200"
          >
            <AccordionTrigger className="px-3 md:px-6 hover:no-underline py-3 bg-lunar-accent/5 rounded-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-3 md:gap-4">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 md:h-4 md:w-4 text-lunar-textSecondary" />
                    <span className="font-medium text-xs md:text-sm text-lunar-text">
                      {formatDateForDisplay(item.data)}
                    </span>
                  </div>
                  {item.status && (
                    <Badge className={`text-[11px] md:text-xs ${getStatusBadge(item.status)}`}>
                      {item.status}
                    </Badge>
                  )}
                </div>
                
                {/* Informações do Pacote - Responsivo */}
                <div className="flex-1 md:mx-8">
                  <div className="text-left space-y-1">
                    <div className="font-medium text-xs md:text-sm text-lunar-text break-words">
                      {item.pacote || 'Pacote não especificado'}
                    </div>
                    <div className="text-[11px] md:text-xs text-lunar-textSecondary break-words text-ellipsis overflow-hidden">
                      {item.categoria || ''} {item.categoria && item.descricao && '•'} {item.descricao || ''}
                    </div>
                  </div>
                </div>

                {/* Métricas Financeiras - Grid responsivo para tablets */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 text-center md:text-right">
                  <div className="flex flex-col items-center md:items-end">
                    <span className="text-[11px] md:text-xs text-lunar-textSecondary uppercase tracking-wide">Total</span>
                    <span className="font-bold text-chart-blue-1 text-[11px] md:text-xs">{formatCurrency(item.total || 0)}</span>
                  </div>
                  
                  <div className="flex flex-col items-center md:items-end">
                    <span className="text-[11px] md:text-xs text-lunar-textSecondary">Pago</span>
                    <span className="font-semibold text-chart-green-1 text-[11px] md:text-xs text-green-600">{formatCurrency(item.valorPago || 0)}</span>
                  </div>
                  
                  <div className="flex flex-col items-center md:items-end">
                    <span className="text-[11px] md:text-xs text-lunar-textSecondary">Agendado</span>
                    <span className="font-semibold text-chart-orange-1 text-[11px] md:text-xs text-orange-400">{formatCurrency(item.totalAgendado || 0)}</span>
                  </div>
                  
                  <div className="flex flex-col items-center md:items-end">
                    <span className="text-[11px] md:text-xs text-lunar-textSecondary">Pendente</span>
                    <span className="font-semibold text-chart-yellow-1 text-[11px] md:text-xs text-red-500">{formatCurrency(item.restante || 0)}</span>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent className="px-4 md:px-6 pb-6">
              <SessionPaymentHistory 
                sessionData={item} 
                onPaymentUpdate={async (sessionId, totalPaid, fullPaymentsArray) => {
                  // Atualizar sessão no Supabase via useWorkflowRealtime
                  try {
                    await updateSession(sessionId, {
                      valorPago: totalPaid,
                      pagamentos: fullPaymentsArray
                    }, true); // silent update
                  } catch (error) {
                    console.error('Erro ao atualizar pagamento:', error);
                  }
                }} 
              />

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-8">
                {/* COMPOSIÇÃO DO VALOR */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="h-4 w-4 text-lunar-accent" />
                    <h3 className="font-semibold text-sm text-lunar-text uppercase tracking-wide">
                      Composição do Valor
                    </h3>
                  </div>
                  
                  <div className="space-y-3 rounded-lg p-4 bg-muted py-[6px]">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-lunar-textSecondary">Base do Pacote</span>
                      <span className="font-semibold text-lunar-text text-xs">{formatCurrency(item.valorPacote || 0)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-lunar-textSecondary">Fotos Extras</span>
                      <span className="font-semibold text-lunar-text text-xs">{formatCurrency(item.valorTotalFotoExtra || 0)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-lunar-textSecondary">Produtos</span>
                      <span className="font-semibold text-lunar-text text-xs">{formatCurrency(item.valorTotalProduto || 0)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-lunar-textSecondary">Adicional</span>
                      <span className="font-semibold text-lunar-text text-xs">{formatCurrency(item.valorAdicional || 0)}</span>
                    </div>
                    
                    {item.desconto > 0 && <div className="flex justify-between items-center">
                        <span className="text-xs text-lunar-textSecondary">Desconto</span>
                        <span className="font-semibold text-sm text-error">-{formatCurrency(item.desconto || 0)}</span>
                      </div>}
                    
                    <div className="border-t border-lunar-border/50 pt-3 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-lunar-text">Total</span>
                        <span className="font-bold text-sm text-lunar-text">
                          {formatCurrency(item.total || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                {item.produtosList && item.produtosList.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-lunar-border/30">
                    <div className="flex items-center gap-2 mb-4">
                      <Package className="h-4 w-4 text-lunar-accent" />
                      <h3 className="font-semibold text-sm text-lunar-text uppercase tracking-wide">
                        Produtos Incluídos
                      </h3>
                    </div>
                    <div className="rounded-lg p-4 space-y-3 bg-muted">
                      {item.produtosList.map((p: any, index: number) => (
                        <div 
                          key={index} 
                          className="flex justify-between items-center py-2 border-b border-lunar-border/20 last:border-0"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-lunar-text">{p.nome}</span>
                            {p.quantidade > 1 && (
                              <span className="text-xs text-lunar-textSecondary">
                                Quantidade: {p.quantidade}x
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-sm text-lunar-text">
                            {p.tipo === 'manual' 
                              ? formatCurrency(p.valorUnitario * p.quantidade) 
                              : formatCurrency(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {item.detalhes && (
                  <div className="mt-6 pt-6 border-t border-lunar-border/30">
                    <div className="flex items-center gap-2 mb-3">
                      <History className="h-4 w-4 text-lunar-accent" />
                      <h3 className="font-semibold text-sm text-lunar-text uppercase tracking-wide">
                        Observações
                      </h3>
                    </div>
                    <div className="bg-lunar-accent/5 rounded-lg p-4">
                      <p className="text-sm text-lunar-text leading-relaxed">{item.detalhes}</p>
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