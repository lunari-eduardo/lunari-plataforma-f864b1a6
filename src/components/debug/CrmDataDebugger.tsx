import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle, RefreshCw, Database, Users, Calculator } from "lucide-react";
import { 
  performFullDataAudit, 
  showAuditSummary,
  type DataAuditReport 
} from '@/utils/crmDataAudit';
import { 
  performCompleteDataCorrection, 
  validateCorrection,
  type CorrectionResult 
} from '@/utils/crmDataCorrection';
import { formatCurrency } from '@/utils/financialUtils';

/**
 * Componente de debug para o CRM - FERRAMENTA DE DIAGNÓSTICO COMPLETA
 * 
 * Permite:
 * - Auditar todos os dados do CRM
 * - Executar correções automáticas
 * - Visualizar relatórios detalhados
 * - Monitorar integridade dos dados
 */

export function CrmDataDebugger() {
  const [auditReport, setAuditReport] = useState<DataAuditReport | null>(null);
  const [correctionResult, setCorrectionResult] = useState<CorrectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAudit = async () => {
    setIsLoading(true);
    try {
      const report = performFullDataAudit();
      setAuditReport(report);
      showAuditSummary();
    } catch (error) {
      console.error('Erro na auditoria:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCorrection = async () => {
    setIsLoading(true);
    try {
      const result = performCompleteDataCorrection();
      setCorrectionResult(result);
      
      // Executar nova auditoria após correção
      setTimeout(() => {
        const newReport = performFullDataAudit();
        setAuditReport(newReport);
      }, 1000);
    } catch (error) {
      console.error('Erro na correção:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidation = () => {
    const isValid = validateCorrection();
    alert(isValid ? '✅ Dados validados com sucesso!' : '⚠️ Ainda há problemas nos dados');
  };

  const getProblemSeverity = (count: number) => {
    if (count === 0) return 'default';
    if (count <= 5) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">CRM Data Debugger</h2>
        <div className="flex gap-2">
          <Button onClick={handleAudit} disabled={isLoading} variant="outline">
            <Database className="h-4 w-4 mr-2" />
            Auditar Dados
          </Button>
          <Button onClick={handleCorrection} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Corrigir Dados
          </Button>
          <Button onClick={handleValidation} variant="secondary">
            <CheckCircle className="h-4 w-4 mr-2" />
            Validar
          </Button>
        </div>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin mr-4" />
            <span>Processando...</span>
          </CardContent>
        </Card>
      )}

      {auditReport && (
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="problems">Problemas</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="financial">Financeiro</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{auditReport.summary.totalClientes}</div>
                  <p className="text-xs text-muted-foreground">
                    {auditReport.summary.clientesComWorkflow} com workflow
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Workflows</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{auditReport.summary.totalWorkflowSessions}</div>
                  <p className="text-xs text-muted-foreground">
                    {auditReport.summary.workflowsOrfaos} órfãos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Faturado</CardTitle>
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(auditReport.summary.totalFaturado)}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(auditReport.summary.totalAReceber)} a receber
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="problems" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Problemas Detectados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>ClienteId Ausente</span>
                    <Badge variant={getProblemSeverity(auditReport.problems.clienteIdMissing.length)}>
                      {auditReport.problems.clienteIdMissing.length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>ClienteId Corrompido</span>
                    <Badge variant={getProblemSeverity(auditReport.problems.clienteIdCorrupted.length)}>
                      {auditReport.problems.clienteIdCorrupted.length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Valores NaN</span>
                    <Badge variant={getProblemSeverity(auditReport.problems.valorNaN.length)}>
                      {auditReport.problems.valorNaN.length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Cálculos Inconsistentes</span>
                    <Badge variant={getProblemSeverity(auditReport.problems.inconsistentCalculations.length)}>
                      {auditReport.problems.inconsistentCalculations.length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {correctionResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Última Correção
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>ClienteIds Corrigidos</span>
                      <Badge variant="secondary">{correctionResult.corrections.clienteIdFixed}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>ClienteIds Restaurados</span>
                      <Badge variant="secondary">{correctionResult.corrections.clienteIdRestored}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Clientes Criados</span>
                      <Badge variant="secondary">{correctionResult.corrections.clientsCreated}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Cálculos Corrigidos</span>
                      <Badge variant="secondary">{correctionResult.corrections.calculationsFixed}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="clients" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Análise por Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {auditReport.clientAnalysis
                      .sort((a, b) => b.totalFaturado - a.totalFaturado)
                      .map(cliente => (
                        <div
                          key={cliente.clienteId}
                          className={`p-3 rounded-lg border ${
                            cliente.hasProblems ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{cliente.nome}</h4>
                              <p className="text-sm text-muted-foreground">
                                {cliente.workflowCount} sessões • {formatCurrency(cliente.totalFaturado)} faturado
                              </p>
                              {cliente.hasProblems && (
                                <div className="mt-1 space-y-1">
                                  {cliente.problems.map((problem, index) => (
                                    <Badge key={index} variant="destructive" className="text-xs">
                                      {problem}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-green-600">
                                {formatCurrency(cliente.totalPago)}
                              </div>
                              <div className="text-sm text-orange-600">
                                {formatCurrency(cliente.aReceber)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Faturado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {formatCurrency(auditReport.summary.totalFaturado)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Total Pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(auditReport.summary.totalPago)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>A Receber</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {formatCurrency(auditReport.summary.totalAReceber)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {auditReport.problems.inconsistentCalculations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Cálculos Inconsistentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {auditReport.problems.inconsistentCalculations.map((calc, index) => (
                        <div key={index} className="p-2 border rounded">
                          <div className="font-medium">Workflow: {calc.workflowId}</div>
                          <div className="text-sm text-red-600">
                            Atual: {formatCurrency(calc.actual)} → Esperado: {formatCurrency(calc.expected)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}