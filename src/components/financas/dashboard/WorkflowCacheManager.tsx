/**
 * Componente para gerenciar cache do workflow no dashboard
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Trash2, Database } from 'lucide-react';
import { workflowCacheManager } from '@/services/WorkflowCacheManager';
import { toast } from 'sonner';

export function WorkflowCacheManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [cacheStats, setCacheStats] = useState<{
    totalMonths: number;
    totalSessions: number;
    oldestMonth: string;
    newestMonth: string;
  } | null>(null);

  const handleGetStats = async () => {
    setIsLoading(true);
    try {
      // Acessar cache interno via reflexão (não ideal mas funcional)
      const cache = (workflowCacheManager as any).cache as Map<string, any>;
      
      let totalSessions = 0;
      const months: string[] = [];
      
      cache.forEach((entry, key) => {
        totalSessions += entry.sessions.length;
        months.push(key);
      });
      
      months.sort();
      
      setCacheStats({
        totalMonths: months.length,
        totalSessions,
        oldestMonth: months[0] || 'N/A',
        newestMonth: months[months.length - 1] || 'N/A'
      });
      
      toast.success('Estatísticas do cache atualizadas');
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      toast.error('Erro ao obter estatísticas do cache');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    setIsLoading(true);
    try {
      workflowCacheManager.clearAllCache();
      localStorage.removeItem('workflow-cache');
      setCacheStats(null);
      toast.success('Cache limpo com sucesso');
      
      // Recarregar dados
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      toast.error('Erro ao limpar cache');
      setIsLoading(false);
    }
  };

  const handleReloadCache = async () => {
    setIsLoading(true);
    try {
      await workflowCacheManager.preloadWorkflowRange();
      toast.success('Cache recarregado com sucesso');
      handleGetStats();
    } catch (error) {
      console.error('Erro ao recarregar cache:', error);
      toast.error('Erro ao recarregar cache');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Gerenciador de Cache do Workflow
        </CardTitle>
        <CardDescription>
          Monitore e gerencie o cache de sessões do workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estatísticas */}
        {cacheStats && (
          <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total de Meses</p>
              <p className="text-2xl font-bold">{cacheStats.totalMonths}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Sessões</p>
              <p className="text-2xl font-bold">{cacheStats.totalSessions}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mês Mais Antigo</p>
              <p className="text-lg font-semibold">{cacheStats.oldestMonth}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mês Mais Recente</p>
              <p className="text-lg font-semibold">{cacheStats.newestMonth}</p>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleGetStats}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <Database className="h-4 w-4 mr-2" />
            Ver Estatísticas
          </Button>

          <Button
            onClick={handleReloadCache}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Recarregar Cache
          </Button>

          <Button
            onClick={handleClearCache}
            disabled={isLoading}
            variant="destructive"
            size="sm"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Cache
          </Button>
        </div>

        {/* Informações */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• O cache armazena sessões dos últimos 4 meses (2 anteriores + atual + 1 posterior)</p>
          <p>• Dados são salvos no LocalStorage para persistência entre recarregamentos</p>
          <p>• Sincronização automática via realtime quando novos dados são adicionados</p>
        </div>
      </CardContent>
    </Card>
  );
}