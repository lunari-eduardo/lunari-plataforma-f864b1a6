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
// Função robusta para parsing de valores financeiros
const parseFinancialValue = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  
  // Se já é um número, retornar diretamente
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  // Se é string, limpar e converter
  if (typeof value === 'string') {
    // Remover R$, espaços, pontos de milhares e converter vírgula para ponto
    const cleaned = value
      .replace(/[^\d,.-]/g, '') // Remove tudo exceto dígitos, vírgula, ponto e hífen
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
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');

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
        restante: isNaN(restante) ? 0 : restante
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
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
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
        {workflowData.map((item: any) => <AccordionItem key={item.id} value={item.id} className="border rounded-lg mb-4">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center justify-between w-full mr-4">
                {/* Data */}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-lg">{formatDateForDisplay(item.data)}</span>
                </div>
                
                {/* Informações do Pacote */}
                <div className="flex-1 mx-8">
                  <div className="text-left">
                    <div className="font-medium uppercase tracking-wide">PACOTE</div>
                    <div className="font-medium uppercase tracking-wide">CATEGORIA</div>
                    <div className="font-medium uppercase tracking-wide">DESCRIÇÃO</div>
                  </div>
                </div>

                {/* Valores Financeiros */}
                <div className="text-right">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium uppercase tracking-wide text-xs">TOTAL:</span>
                      <span className="font-bold text-xs">{formatCurrency(item.total || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium uppercase tracking-wide text-xs">PAGO:</span>
                      <span className="font-bold text-green-600 text-xs">{formatCurrency(item.valorPago || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium uppercase tracking-wide text-xs">PENDENTE:</span>
                      <span className="font-bold text-orange-600 text-xs">{formatCurrency(item.restante || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* COMPOSIÇÃO DO VALOR */}
                <div className="space-y-4">
                  <div className="font-bold text-base uppercase tracking-wide mb-4">
                    COMPOSIÇÃO DO VALOR
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium uppercase tracking-wide text-xs">BASE</span>
                      <span className="font-bold text-xs">{formatCurrency(item.valorPacote || 0)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="font-medium uppercase tracking-wide text-xs">TOTAL FOTO EXTRA</span>
                      <span className="font-bold text-xs">{formatCurrency(item.valorTotalFotoExtra || 0)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="font-medium uppercase tracking-wide text-xs">TOTAL PRODUTOS</span>
                      <span className="font-bold text-xs">{formatCurrency(item.valorTotalProduto || 0)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="font-medium uppercase tracking-wide text-xs">ADICIONAL</span>
                      <span className="font-bold text-xs">{formatCurrency(item.valorAdicional || 0)}</span>
                    </div>
                    
                    {item.desconto > 0 && <div className="flex justify-between items-center">
                        <span className="font-medium uppercase tracking-wide text-xs">DESCONTO</span>
                        <span className="font-bold text-red-600 text-xs">-{formatCurrency(item.desconto || 0)}</span>
                      </div>}
                    
                    <div className="border-t pt-3 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold uppercase tracking-wide text-sm">TOTAL:</span>
                        <span className="font-bold text-sm">{formatCurrency(item.total || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SITUAÇÃO FINANCEIRA */}
                <div className="space-y-4">
                  <div className="font-bold text-base uppercase tracking-wide mb-4">
                    SITUAÇÃO FINANCEIRA
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium uppercase tracking-wide flex items-center gap-2 text-sm">
                        <span className="text-green-600">✓</span>
                        VALOR PAGO
                      </span>
                      <span className="font-bold">{formatCurrency(item.valorPago || 0)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="font-medium uppercase tracking-wide flex items-center gap-2 text-sm">
                        <span className="text-orange-600">−</span>
                        A RECEBER
                      </span>
                      <span className="font-bold">{formatCurrency(item.restante || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DESCRIÇÃO DE PRODUTOS */}
              {item.produtosList && item.produtosList.length > 0 && <div className="mt-8 pt-6 border-t">
                  <div className="font-bold text-base uppercase tracking-wide mb-4">
                    DESCRIÇÃO DE PRODUTOS
                  </div>
                  <div className="space-y-2">
                    {item.produtosList.map((p: any, index: number) => <div key={index} className="flex justify-between items-center">
                        <span className="font-medium">{p.nome} {p.quantidade > 1 ? `${p.quantidade}x` : ''}</span>
                        <span className="font-bold">
                          {p.tipo === 'manual' ? formatCurrency(p.valorUnitario * p.quantidade) : formatCurrency(0)}
                        </span>
                      </div>)}
                  </div>
                </div>}

              {/* OBS */}
              {item.detalhes && <div className="mt-8 pt-6 border-t">
                  <div className="font-bold text-base uppercase tracking-wide mb-4">
                    OBS: {item.detalhes}
                  </div>
                </div>}
            </AccordionContent>
          </AccordionItem>)}
      </Accordion>
    </div>;
}