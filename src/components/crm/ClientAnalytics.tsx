import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { ClientMetrics } from '@/hooks/useClientMetrics';
import { UploadedFile } from '@/hooks/useFileUpload';
import { TrendingUp, Calendar, FileText, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';

interface ClientAnalyticsProps {
  metrics: ClientMetrics;
  files: UploadedFile[];
  historico: Array<{
    id: string;
    tipo: 'projeto' | 'workflow' | 'orcamento';
    data: string;
    descricao: string;
    valor: number;
    status: string;
  }>;
}

export function ClientAnalytics({ metrics, files, historico }: ClientAnalyticsProps) {
  const taxaPagamento = metrics.totalFaturado > 0 
    ? (metrics.totalPago / metrics.totalFaturado) * 100 
    : 0;

  const ticketMedio = metrics.sessoes > 0 
    ? metrics.totalFaturado / metrics.sessoes 
    : 0;

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getClientStatus = () => {
    if (metrics.aReceber > 0) return { 
      icon: AlertTriangle, 
      text: 'Valores em aberto', 
      color: 'text-orange-600' 
    };
    return { 
      icon: CheckCircle, 
      text: 'Em dia', 
      color: 'text-green-600' 
    };
  };

  const clientStatus = getClientStatus();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Resumo Financeiro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-semibold text-primary">{formatCurrency(metrics.totalFaturado)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Pago</span>
              <span className="font-semibold text-green-600">{formatCurrency(metrics.totalPago)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">A Receber</span>
              <span className="font-semibold text-orange-600">{formatCurrency(metrics.aReceber)}</span>
            </div>
          </div>
          
          <div className="pt-4 border-t space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Taxa de Pagamento</span>
              <Badge className={getStatusColor(taxaPagamento)}>
                {Math.round(taxaPagamento)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Ticket Médio</span>
              <span className="font-semibold">{formatCurrency(ticketMedio)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engajamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Engajamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total de Sessões</span>
              <span className="font-semibold text-blue-600">{metrics.sessoes}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Arquivos Enviados</span>
              <span className="font-semibold">{files.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Última Sessão</span>
              <span className="text-sm">
                {metrics.ultimaSessao 
                  ? formatDateForDisplay(metrics.ultimaSessao.toISOString())
                  : 'Nunca'
                }
              </span>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center gap-2">
              <clientStatus.icon className={`h-4 w-4 ${clientStatus.color}`} />
              <span className={`text-sm ${clientStatus.color}`}>
                {clientStatus.text}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Resumido */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-purple-600" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {historico.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateForDisplay(item.data)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-green-600 flex-shrink-0">
                  {formatCurrency(item.valor)}
                </span>
              </div>
            ))}
            {historico.length > 5 && (
              <p className="text-center text-xs text-muted-foreground pt-2">
                +{historico.length - 5} itens mais antigos
              </p>
            )}
            {historico.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Nenhum histórico encontrado
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status e Insights */}
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Insights do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Status do Cliente</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.aReceber > 0 ? 'bg-orange-500' : 'bg-green-500'
                  }`}></div>
                  <span className="text-sm">
                    {metrics.aReceber > 0 ? 'Possui valores em aberto' : 'Em dia com pagamentos'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    metrics.sessoes >= 3 ? 'bg-blue-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-sm">
                    {metrics.sessoes >= 3 ? 'Cliente recorrente' : 'Cliente em desenvolvimento'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    files.length > 0 ? 'bg-purple-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-sm">
                    {files.length > 0 ? 'Documentação organizada' : 'Sem documentos'}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Recomendações</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                {metrics.aReceber > 0 && (
                  <p>• Acompanhar valores em aberto para cobrança</p>
                )}
                {metrics.sessoes >= 3 && (
                  <p>• Cliente fiel - considerar programa de fidelidade</p>
                )}
                {metrics.totalFaturado > 5000 && (
                  <p>• Cliente de alto valor - priorizar atendimento</p>
                )}
                {files.length === 0 && (
                  <p>• Considerar solicitar documentos importantes</p>
                )}
                {taxaPagamento < 70 && (
                  <p>• Baixa taxa de pagamento - revisar política de cobrança</p>
                )}
                {historico.length > 0 && historico[0] && (
                  <p>• Último contato: {formatDateForDisplay(historico[0].data)}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}