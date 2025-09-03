import { useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { History, Calendar, DollarSign, Package, CreditCard } from "lucide-react";
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { Cliente } from '@/types/orcamentos';
import { SessionPaymentHistory } from './SessionPaymentHistory';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
interface WorkflowHistoryTableProps {
  cliente: Cliente;
}
// Função robusta para parsing de valores financeiros
const parseFinancialValue = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;

  // Se já é um número, retornar diretamente
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  // Se é string, limpar e converter
  if (typeof value === 'string') {
    // Remover R$, espaços, pontos de milhares e converter vírgula para ponto
    const cleaned = value.replace(/[^\d,.-]/g, '') // Remove tudo exceto dígitos, vírgula, ponto e hífen
    .replace(/\./g, '') // Remove pontos (milhares)
    .replace(/,/g, '.'); // Converte vírgula para ponto

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};
export function WorkflowHistoryTable({
  cliente
}: WorkflowHistoryTableProps) {
  const workflowData = useMemo(() => {
    if (!cliente) return [];

    // FONTE ÚNICA: workflow_sessions com dados corrigidos E deduplicados
    const workflowSessions = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);

    // Filtrar sessões do cliente (by clienteId E nome como fallback)
    const clientSessions = workflowSessions.filter((session: any) => {
      const matchByClienteId = session.clienteId === cliente.id;
      const matchByName = !session.clienteId && session.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
      return matchByClienteId || matchByName;
    }).sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

    // DEDUPLICAÇÃO FINAL por sessionId (caso ainda existam duplicatas)
    const sessionMap = new Map();
    clientSessions.forEach((session: any) => {
      const sessionKey = session.sessionId || session.id;
      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, session);
      }
    });

    // Corrigir cálculos de cada sessão com parsing robusto
    return Array.from(sessionMap.values()).map((session: any) => {
      const valorPacote = parseFinancialValue(session.valorPacote);
      const desconto = parseFinancialValue(session.desconto);
      const valorTotalFotoExtra = parseFinancialValue(session.valorTotalFotoExtra);
      const valorTotalProduto = parseFinancialValue(session.valorTotalProduto);
      const valorAdicional = parseFinancialValue(session.valorAdicional);
      const valorPago = parseFinancialValue(session.valorPago);

      // CÁLCULO CORRETO DO TOTAL com validação
      const totalCalculado = valorPacote + valorTotalFotoExtra + valorTotalProduto + valorAdicional - desconto;

      // Validação final para garantir que não há NaN
      const totalFinal = isNaN(totalCalculado) ? 0 : totalCalculado;
      const restante = totalFinal - valorPago;

      // CALCULAR VALOR AGENDADO baseado nos pagamentos da sessão
      const payments = session.pagamentos || [];
      const totalAgendado = payments
        .filter((p: any) => p.statusPagamento === 'pendente' && p.dataVencimento)
        .reduce((acc: number, p: any) => acc + parseFinancialValue(p.valor), 0);

      // Debug log para identificar problemas nos dados
      if (isNaN(totalCalculado)) {
        console.warn('Cálculo de total resultou em NaN:', {
          sessionId: session.sessionId || session.id,
          valorPacote,
          valorTotalFotoExtra,
          valorTotalProduto,
          valorAdicional,
          desconto,
          originalSession: session
        });
      }
      return {
        ...session,
        valorPacote,
        valorTotalFotoExtra,
        valorTotalProduto,
        valorAdicional,
        desconto,
        valorPago,
        total: totalFinal,
        restante: isNaN(restante) ? 0 : restante,
        totalAgendado
      };
    }).sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [cliente]);
  const getStatusBadge = (status: string) => {
    const colors = {
      'Agendado': 'bg-blue-100 text-blue-800',
      'Concluído': 'bg-green-100 text-green-800',
      'Cancelado': 'bg-red-100 text-red-800',
      'Em Andamento': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status as keyof typeof colors] || 'bg-muted text-foreground';
  };
  if (workflowData.length === 0) {
    return <div className="text-center py-8">
        <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum histórico encontrado</h3>
        <p className="text-muted-foreground">
          Este cliente ainda não possui trabalhos registrados no workflow.
        </p>
      </div>;
  }
  return <div className="space-y-4">
      <Accordion type="single" collapsible className="w-full">
        {workflowData.map((item: any) => <AccordionItem key={item.id} value={item.id} className="border border-lunar-border rounded-lg mb-4 bg-lunar-surface shadow-lunar-sm hover:shadow-lunar-md transition-all duration-200">
            <AccordionTrigger className="px-3 md:px-6 hover:no-underline py-3 bg-lunar-accent/5 rounded-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-3 md:gap-4">
                {/* Data e Status - Mobile First */}
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 md:h-4 md:w-4 text-lunar-textSecondary" />
                    <span className="font-medium text-xs md:text-sm text-lunar-text">{formatDateForDisplay(item.data)}</span>
                  </div>
                  {item.status && <Badge className={`text-[11px] md:text-xs ${getStatusBadge(item.status)}`}>
                      {item.status}
                    </Badge>}
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
              {/* HISTÓRICO DE PAGAMENTOS - COMPONENTE NOVO */}
              <SessionPaymentHistory sessionData={item} onPaymentUpdate={(sessionId, totalPaid, fullPaymentsArray) => {
            // Atualizar o storage com pagamentos completos
            const sessions = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
            const updatedSessions = sessions.map((s: any) => s.id === sessionId ? {
              ...s,
              valorPago: totalPaid,
              pagamentos: fullPaymentsArray || s.pagamentos
            } : s);
            storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, updatedSessions);

            // Disparar evento para sincronização
            window.dispatchEvent(new CustomEvent('workflowSessionsUpdated'));
          }} />

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
                        <span className="font-bold text-sm text-lunar-text">{formatCurrency(item.total || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* DESCRIÇÃO DE PRODUTOS */}
              {item.produtosList && item.produtosList.length > 0 && <div className="mt-6 pt-6 border-t border-lunar-border/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-4 w-4 text-lunar-accent" />
                    <h3 className="font-semibold text-sm text-lunar-text uppercase tracking-wide">
                      Produtos Incluídos
                    </h3>
                  </div>
                  <div className="rounded-lg p-4 space-y-3 bg-muted">
                    {item.produtosList.map((p: any, index: number) => <div key={index} className="flex justify-between items-center py-2 border-b border-lunar-border/20 last:border-0">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-lunar-text">{p.nome}</span>
                          {p.quantidade > 1 && <span className="text-xs text-lunar-textSecondary">Quantidade: {p.quantidade}x</span>}
                        </div>
                        <span className="font-semibold text-sm text-lunar-text">
                          {p.tipo === 'manual' ? formatCurrency(p.valorUnitario * p.quantidade) : formatCurrency(0)}
                        </span>
                      </div>)}
                  </div>
                </div>}

              {/* OBSERVAÇÕES */}
              {item.detalhes && <div className="mt-6 pt-6 border-t border-lunar-border/30">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="h-4 w-4 text-lunar-accent" />
                    <h3 className="font-semibold text-sm text-lunar-text uppercase tracking-wide">
                      Observações
                    </h3>
                  </div>
                  <div className="bg-lunar-accent/5 rounded-lg p-4">
                    <p className="text-sm text-lunar-text leading-relaxed">{item.detalhes}</p>
                  </div>
                </div>}
            </AccordionContent>
          </AccordionItem>)}
      </Accordion>
    </div>;
}