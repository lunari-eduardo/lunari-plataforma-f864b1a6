import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { MetasService, IndicadoresService, BackupService } from '@/services/PricingService';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { StatusSalvamento } from '@/types/precificacao';
interface MetasIndicadoresProps {
  custosFixosTotal: number;
}

interface HistoricalGoal {
  ano: number;
  metaFaturamento: number;
  metaLucro: number;
  dataCriacao: string;
  margemLucroDesejada: number;
}
export function MetasIndicadores({
  custosFixosTotal
}: MetasIndicadoresProps) {
  const [margemLucroDesejada, setMargemLucroDesejada] = useState(30);
  const [statusSalvamento, setStatusSalvamento] = useState<StatusSalvamento>('nao_salvo');

  // Carregar dados salvos - NOVO SISTEMA
  useEffect(() => {
    try {
      setStatusSalvamento('salvando');
      const dados = MetasService.carregar();
      setMargemLucroDesejada(dados.margemLucroDesejada);
      setStatusSalvamento('salvo');
      IndicadoresService.atualizarIndicador('metas', 'salvo', 'Dados carregados');
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
      setStatusSalvamento('erro');
    }
  }, []);

  // Salvar dados automaticamente - NOVO SISTEMA
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        setStatusSalvamento('salvando');
        
        const currentYear = new Date().getFullYear();
        const faturamentoMinimoAnual = custosFixosTotal * 12;
        const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - margemLucroDesejada / 100);
        const metaLucroAnual = metaFaturamentoAnual - faturamentoMinimoAnual;
        
        const dadosParaSalvar = {
          margemLucroDesejada,
          ano: currentYear,
          metaFaturamentoAnual,
          metaLucroAnual
        };
        
        const sucesso = MetasService.salvar(dadosParaSalvar);
        
        if (sucesso) {
          setStatusSalvamento('salvo');
          IndicadoresService.atualizarIndicador('metas', 'salvo', 'Salvo automaticamente');
          
          // Salvar/atualizar metas históricas
          saveHistoricalGoals();
        } else {
          setStatusSalvamento('erro');
        }
      } catch (error) {
        console.error('Erro no auto-save das metas:', error);
        setStatusSalvamento('erro');
      }
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [margemLucroDesejada, custosFixosTotal]);

  const saveHistoricalGoals = () => {
    const currentYear = new Date().getFullYear();
    const faturamentoMinimoAnual = custosFixosTotal * 12;
    const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - margemLucroDesejada / 100);
    const metaLucroAnual = metaFaturamentoAnual - faturamentoMinimoAnual;
    
    // Carregar metas históricas existentes
    const historicalGoals: HistoricalGoal[] = storage.load(STORAGE_KEYS.HISTORICAL_GOALS, []);
    
    // Verificar se já existe uma entrada para o ano atual
    const existingGoalIndex = historicalGoals.findIndex(goal => goal.ano === currentYear);
    
    const newGoal: HistoricalGoal = {
      ano: currentYear,
      metaFaturamento: metaFaturamentoAnual,
      metaLucro: metaLucroAnual,
      dataCriacao: new Date().toISOString().split('T')[0],
      margemLucroDesejada
    };
    
    if (existingGoalIndex !== -1) {
      // Atualizar entrada existente
      historicalGoals[existingGoalIndex] = newGoal;
    } else {
      // Adicionar nova entrada
      historicalGoals.push(newGoal);
    }
    
    // Salvar de volta
    storage.save(STORAGE_KEYS.HISTORICAL_GOALS, historicalGoals);
  };

  // Cálculos dos indicadores
  const faturamentoMinimoAnual = custosFixosTotal * 12;
  const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - margemLucroDesejada / 100);
  const metaFaturamentoMensal = metaFaturamentoAnual / 12;
  const metaLucroAnual = metaFaturamentoAnual - faturamentoMinimoAnual;
  // Salvar manualmente
  const salvarManualmente = () => {
    try {
      setStatusSalvamento('salvando');
      
      const currentYear = new Date().getFullYear();
      const faturamentoMinimoAnual = custosFixosTotal * 12;
      const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - margemLucroDesejada / 100);
      const metaLucroAnual = metaFaturamentoAnual - faturamentoMinimoAnual;
      
      const dadosParaSalvar = {
        margemLucroDesejada,
        ano: currentYear,
        metaFaturamentoAnual,
        metaLucroAnual
      };
      
      const sucesso = MetasService.salvar(dadosParaSalvar);
      
      if (sucesso) {
        setStatusSalvamento('salvo');
        IndicadoresService.atualizarIndicador('metas', 'salvo', 'Salvo manualmente');
      } else {
        setStatusSalvamento('erro');
      }
    } catch (error) {
      console.error('Erro no salvamento manual:', error);
      setStatusSalvamento('erro');
    }
  };

  // Fazer backup completo
  const fazerBackup = () => {
    try {
      BackupService.downloadBackup();
      console.log('✅ Backup realizado com sucesso');
    } catch (error) {
      console.error('Erro ao fazer backup:', error);
    }
  };

  // Renderizar indicador de status
  const renderStatusIndicator = () => {
    switch (statusSalvamento) {
      case 'salvando':
        return <div className="flex items-center gap-1 text-xs text-blue-600">
          <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full" />
          Salvando...
        </div>;
      case 'salvo':
        return <div className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle className="h-3 w-3" />
          Salvo
        </div>;
      case 'erro':
        return <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          Erro
        </div>;
      default:
        return <div className="flex items-center gap-1 text-xs text-gray-500">
          <AlertCircle className="h-3 w-3" />
          Não salvo
        </div>;
    }
  };

  return <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg text-green-600">Metas e Indicadores de Lucro</CardTitle>
            <p className="text-sm text-muted-foreground">
              Defina suas metas financeiras e acompanhe os indicadores de lucro.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda - Definição de Metas */}
          <div>
            <h3 className="font-semibold mb-4">Definição de Metas</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="margem-lucro">Margem de Lucro Desejada (%)</Label>
                <Input id="margem-lucro" type="number" min="0" max="100" step="1" value={margemLucroDesejada} onChange={e => setMargemLucroDesejada(Number(e.target.value))} className="max-w-32" />
              </div>
            </div>
          </div>

          {/* Coluna Direita - Indicadores Financeiros */}
          <div>
            <h3 className="font-semibold mb-4">Indicadores Financeiros</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm">Faturamento Mínimo Anual:</span>
                <span className="font-medium">R$ {faturamentoMinimoAnual.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-blue-600">Meta de Faturamento Anual:</span>
                <span className="font-medium text-blue-600">R$ {metaFaturamentoAnual.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-green-600">Meta de Faturamento Mensal:</span>
                <span className="font-medium text-green-600">R$ {metaFaturamentoMensal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-purple-600">Meta de Lucro Anual:</span>
                <span className="font-medium text-purple-600">R$ {metaLucroAnual.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>;
}