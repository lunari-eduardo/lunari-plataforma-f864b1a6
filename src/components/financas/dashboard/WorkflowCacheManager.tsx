/**
 * Componente para gerenciar cache do workflow no dashboard
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { autoFixWorkflowCache, validateCacheConsistency, recalculateWorkflowCache } from '@/utils/workflowCacheManager';

export function WorkflowCacheManager() {
  const [validationResult, setValidationResult] = useState<{
    isConsistent: boolean;
    discrepancies: string[];
    recommendation: string;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

  const handleValidateCache = async () => {
    setIsLoading(true);
    try {
      const result = validateCacheConsistency();
      setValidationResult(result);
    } catch (error) {
      console.error('Erro na validação:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFixCache = async () => {
    setIsLoading(true);
    try {
      autoFixWorkflowCache();
      // Revalidar após correção
      setTimeout(() => {
        const result = validateCacheConsistency();
        setValidationResult(result);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Erro na correção:', error);
      setIsLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setIsLoading(true);
    try {
      recalculateWorkflowCache();
      setTimeout(() => {
        window.location.reload(); // Reload para atualizar dashboard
      }, 1000);
    } catch (error) {
      console.error('Erro no recálculo:', error);
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-orange-200 bg-orange-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Correção de Cache - Workflow
        </CardTitle>
        <CardDescription className="text-xs text-orange-600">
          Ferramenta temporária para corrigir duplicação de valores
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleValidateCache}
            disabled={isLoading}
            className="text-xs"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Validar Cache
          </Button>
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleFixCache}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Correção Automática
          </Button>
          
          <Button 
            size="sm" 
            variant="destructive"
            onClick={handleRecalculate}
            disabled={isLoading}
            className="text-xs"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Recalcular Tudo
          </Button>
        </div>

        {validationResult && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={validationResult.isConsistent ? "default" : "destructive"}>
                {validationResult.isConsistent ? 'Cache Consistente' : `${validationResult.discrepancies.length} Problemas`}
              </Badge>
            </div>
            
            {validationResult.discrepancies.length > 0 && (
              <div className="bg-white p-2 rounded border">
                <p className="text-xs font-medium text-red-700 mb-1">Problemas encontrados:</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {validationResult.discrepancies.slice(0, 3).map((discrepancy, index) => (
                    <li key={index} className="truncate">• {discrepancy}</li>
                  ))}
                  {validationResult.discrepancies.length > 3 && (
                    <li className="text-red-500">+ {validationResult.discrepancies.length - 3} outros...</li>
                  )}
                </ul>
                <p className="text-xs text-blue-600 mt-2 font-medium">
                  {validationResult.recommendation}
                </p>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Processando...
          </div>
        )}
      </CardContent>
    </Card>
  );
}