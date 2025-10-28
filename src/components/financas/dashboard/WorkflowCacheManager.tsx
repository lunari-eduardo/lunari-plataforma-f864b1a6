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
  return;
}