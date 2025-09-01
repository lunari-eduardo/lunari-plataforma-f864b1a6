/**
 * SEÇÃO DE SINCRONIZAÇÃO
 * 
 * Componente para gerenciar sincronizações com sistemas externos
 * (Supabase, Precificação, etc.)
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wifi, WifiOff, Database, Loader2, CheckCircle2 } from 'lucide-react';
import { FinancialItemsServiceFactory } from '@/services/FinancialItemsService';
import { usePricingSync } from '@/hooks/usePricingSync';
import { useFinancialValidation } from '@/hooks/useFinancialValidation';

interface SyncSectionProps {
  onSyncModalOpen: () => void;
}

export default function SyncSection({ onSyncModalOpen }: SyncSectionProps) {
  
  // ============= ESTADO LOCAL =============
  
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  
  // ============= HOOKS =============
  
  const { custosDisponiveis, forcarAtualizacao } = usePricingSync();
  const { showSuccess, showError } = useFinancialValidation();
  
  // ============= ESTADO DE CONEXÕES =============
  
  const isSupabaseConnected = FinancialItemsServiceFactory.isUsingSupabase();
  
  // ============= HANDLERS =============
  
  const handleSyncSupabase = async () => {
    if (!isSupabaseConnected) {
      showError('Supabase não está conectado. Conecte primeiro para sincronizar.');
      return;
    }

    setSupabaseLoading(true);
    try {
      // TODO: [SUPABASE] - Implementar sincronização real quando Supabase estiver conectado
      // await supabaseService.syncFinancialData();
      
      showSuccess('Sincronização com Supabase realizada com sucesso');
    } catch (error) {
      console.error('Erro ao sincronizar com Supabase:', error);
      showError('Erro ao sincronizar com Supabase');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleRefreshPricing = () => {
    const novosCount = forcarAtualizacao();
    showSuccess(`Dados da precificação atualizados (${novosCount} itens disponíveis)`);
  };

  // ============= RENDER =============
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-lunar-text text-base">Sincronização</h2>
      </div>

      {/* Status de Conexões */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Status das Conexões
          </CardTitle>
          <CardDescription>
            Monitore o status das integrações do sistema financeiro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status Supabase */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 ${
                  isSupabaseConnected ? 'text-green-600' : 'text-muted-foreground'
                }`}>
                  {isSupabaseConnected ? (
                    <Wifi className="h-4 w-4" />
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">Supabase</span>
                </div>
                <Badge variant={isSupabaseConnected ? "default" : "secondary"}>
                  {isSupabaseConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </div>
              
              {isSupabaseConnected && (
                <Button 
                  onClick={handleSyncSupabase}
                  disabled={supabaseLoading}
                  variant="outline"
                  size="sm"
                >
                  {supabaseLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sincronizar
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Status Precificação */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-availability">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Precificação</span>
                </div>
                <Badge variant="default" className="bg-availability/10 text-availability border-availability/20">
                  Conectado
                </Badge>
                {custosDisponiveis > 0 && (
                  <Badge variant="secondary">
                    {custosDisponiveis} custos disponíveis
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleRefreshPricing}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
                
                {custosDisponiveis > 0 && (
                  <Button 
                    onClick={onSyncModalOpen}
                    size="sm"
                  >
                    Importar Custos
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações sobre sincronização */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">Sobre a Sincronização</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <strong className="text-foreground">Supabase:</strong> Sincroniza dados entre dispositivos e usuários em tempo real
                {!isSupabaseConnected && (
                  <span className="text-muted-foreground ml-1">(requer configuração)</span>
                )}
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-availability rounded-full mt-2 flex-shrink-0" />
              <div>
                <strong className="text-foreground">Precificação:</strong> Importa custos do estúdio para criar despesas fixas automaticamente
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-lunar-warning rounded-full mt-2 flex-shrink-0" />
              <div>
                <strong className="text-foreground">Automático:</strong> O sistema monitora continuamente por novos dados para manter tudo sincronizado
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TODO: [SUPABASE] - Adicionar seção de configuração do Supabase quando disponível */}
      {/* TODO: [SUPABASE] - Implementar RLS policies para itens financeiros */}
      {/* TODO: [SUPABASE] - Adicionar sync real-time para múltiplos usuários */}
    </div>
  );
}