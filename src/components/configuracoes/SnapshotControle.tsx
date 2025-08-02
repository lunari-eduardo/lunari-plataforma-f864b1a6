/**
 * COMPONENTE DE CONTROLE DO SISTEMA DE SNAPSHOT
 * 
 * Interface para gerenciar o sistema de fixação de valores de fotos extras
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/contexts/AppContext';
import { obterConfiguracaoPrecificacao } from '@/utils/precificacaoUtils';
import { debugSnapshotSistema } from '@/services/SnapshotValoresService';
import { AlertTriangle, Lock, Unlock, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

export function SnapshotControle() {
  const { fazerSnapshotValores, workflowItems } = useAppContext();
  const [modeloAtual, setModeloAtual] = useState<'fixo' | 'global' | 'categoria'>('fixo');
  const [estatisticas, setEstatisticas] = useState({
    total: 0,
    fixados: 0,
    dinamicos: 0
  });

  useEffect(() => {
    // Carregar configuração atual
    const config = obterConfiguracaoPrecificacao();
    setModeloAtual(config.modelo);

    // Calcular estatísticas
    const total = workflowItems.length;
    const fixados = workflowItems.filter(item => item.isValorFixado).length;
    const dinamicos = total - fixados;

    setEstatisticas({ total, fixados, dinamicos });
  }, [workflowItems]);

  const handleSnapshot = () => {
    if (confirm(
      'Isso vai fixar os valores atuais de fotos extras para TODOS os agendamentos existentes. ' +
      'Esta ação é irreversível e garante que mudanças futuras no modelo de precificação não afetarão agendamentos existentes. ' +
      '\n\nContinuar?'
    )) {
      fazerSnapshotValores();
    }
  };

  const getModeloLabel = (modelo: string) => {
    switch (modelo) {
      case 'fixo': return 'Valor Fixo por Pacote';
      case 'global': return 'Tabela Progressiva Global';
      case 'categoria': return 'Tabela por Categoria';
      default: return modelo;
    }
  };

  const getModeloColor = (modelo: string) => {
    switch (modelo) {
      case 'fixo': return 'bg-blue-100 text-blue-800';
      case 'global': return 'bg-green-100 text-green-800';
      case 'categoria': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Sistema de Snapshot de Valores
          </CardTitle>
          <CardDescription>
            Controle a fixação de valores de fotos extras para manter consistência quando as regras de precificação mudarem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Atual */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold">{estatisticas.total}</div>
              <div className="text-sm text-slate-600">Total de Agendamentos</div>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-700">{estatisticas.fixados}</div>
              <div className="text-sm text-slate-600">Valores Fixados</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{estatisticas.dinamicos}</div>
              <div className="text-sm text-slate-600">Valores Dinâmicos</div>
            </div>
          </div>

          {/* Modelo Atual */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Modelo Atual:</span>
            <Badge className={getModeloColor(modeloAtual)}>
              {getModeloLabel(modeloAtual)}
            </Badge>
          </div>

          {/* Alertas e Informações */}
          {estatisticas.dinamicos > 0 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Atenção:</strong> Você tem {estatisticas.dinamicos} agendamentos com valores dinâmicos. 
                Se você mudar o modelo de precificação, esses valores serão recalculados automaticamente.
              </div>
            </div>
          )}

          {/* Controles */}
          <div className="flex gap-2">
            <Button 
              onClick={handleSnapshot}
              variant="default"
              className="flex items-center gap-2"
              disabled={estatisticas.dinamicos === 0}
            >
              <Lock className="h-4 w-4" />
              Fixar Todos os Valores
            </Button>
            
            <Button 
              onClick={debugSnapshotSistema}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Info className="h-4 w-4" />
              Debug Sistema
            </Button>
          </div>

          {/* Explicação */}
          <div className="text-sm text-slate-600 space-y-2">
            <p><strong>Como funciona:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Valores <strong>fixados</strong> nunca mudam, mesmo se você alterar as regras de precificação</li>
              <li>Valores <strong>dinâmicos</strong> são recalculados automaticamente conforme as regras atuais</li>
              <li>Recomendado fixar valores antes de mudar o modelo de precificação</li>
              <li>Você pode descongelar valores individualmente na tabela do workflow</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}