/**
 * Component to show Supabase migration status and controls
 * Provides debugging and migration management for pricing system
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePricingSupabase } from '@/hooks/usePricingSupabase';
import { toast } from 'sonner';
import { 
  Database, 
  Cloud, 
  RefreshCw, 
  Download, 
  Upload, 
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

export function PricingSupabaseStatus() {
  const { 
    isInitialized, 
    isLoading, 
    configuration, 
    globalTable,
    refreshData,
    resetMigration,
    migrationService
  } = usePricingSupabase();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      toast.success('Dados atualizados!');
    } catch (error) {
      toast.error('Erro ao atualizar dados');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResetMigration = () => {
    resetMigration();
  };

  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge variant="outline" className="flex items-center gap-1">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Carregando...
      </Badge>;
    }
    
    if (isInitialized) {
      return <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Conectado ao Supabase
      </Badge>;
    }
    
    return <Badge variant="destructive" className="flex items-center gap-1">
      <XCircle className="w-3 h-3" />
      Usando dados locais
    </Badge>;
  };

  const getMigrationStatus = () => {
    const needsMigration = migrationService.isMigrationNeeded();
    
    if (needsMigration) {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Migração pendente
      </Badge>;
    }
    
    return <Badge variant="outline" className="flex items-center gap-1">
      <CheckCircle className="w-3 h-3" />
      Migração concluída
    </Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Status do Supabase - Precificação
        </CardTitle>
        <CardDescription>
          Estado atual da sincronização dos dados de precificação com o banco de dados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Geral */}
        <div className="flex items-center justify-between">
          <span className="font-medium">Status da Conexão:</span>
          {getStatusBadge()}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium">Status da Migração:</span>
          {getMigrationStatus()}
        </div>

        <Separator />

        {/* Informações dos Dados */}
        <div className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            Dados Carregados
          </h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Modelo de Precificação:</span>
              <p className="text-muted-foreground capitalize">
                {configuration.modelo}
              </p>
            </div>
            
            <div>
              <span className="font-medium">Tabela Global:</span>
              <p className="text-muted-foreground">
                {globalTable ? globalTable.nome : 'Não configurada'}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Ações de Controle */}
        <div className="space-y-2">
          <h4 className="font-semibold">Ações de Controle</h4>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </Button>

            {migrationService.isMigrationNeeded() && (
              <Button
                variant="outline" 
                size="sm"
                onClick={() => {
                  migrationService.executeMigration().then(() => {
                    handleRefresh();
                  });
                }}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Executar Migração
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetMigration}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Resetar Migração
            </Button>
          </div>
        </div>

        {/* Avisos */}
        {!isInitialized && !isLoading && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Sistema usando dados locais. Faça login para sincronizar com o Supabase.
            </p>
          </div>
        )}

        {isInitialized && configuration.modelo === 'categoria' && !globalTable && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Modelo por categoria ativo. Configure tabelas específicas para cada categoria.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}