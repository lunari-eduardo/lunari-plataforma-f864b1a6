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

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-lg text-primary flex items-center gap-2">
              📊 Metas e Indicadores
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure metas e monitore indicadores
            </p>
          </div>
          {renderStatusIndicator()}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Configuração de Margem */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="margem-lucro" className="text-sm font-medium">
              Margem de Lucro Desejada
            </Label>
            <span className="text-xs text-muted-foreground">{margemLucroDesejada}%</span>
          </div>
          <Input 
            id="margem-lucro" 
            type="number" 
            min="0" 
            max="100" 
            step="1" 
            value={margemLucroDesejada} 
            onChange={e => setMargemLucroDesejada(Number(e.target.value))} 
            className="text-center font-medium"
          />
        </div>

        {/* Indicadores em Cards */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground border-b pb-2">Indicadores Financeiros</h4>
          
          <div className="space-y-3">
            {/* Faturamento Mínimo */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Faturamento Mínimo</span>
                <p className="text-sm font-medium">Anual</p>
              </div>
              <span className="text-sm font-semibold text-foreground">
                R$ {faturamentoMinimoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Meta Anual */}
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="space-y-1">
                <span className="text-xs text-blue-600">Meta de Faturamento</span>
                <p className="text-sm font-medium text-blue-700">Anual</p>
              </div>
              <span className="text-sm font-bold text-blue-600">
                R$ {metaFaturamentoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Meta Mensal */}
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="space-y-1">
                <span className="text-xs text-green-600">Meta de Faturamento</span>
                <p className="text-sm font-medium text-green-700">Mensal</p>
              </div>
              <span className="text-sm font-bold text-green-600">
                R$ {metaFaturamentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Lucro Anual */}
            <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="space-y-1">
                <span className="text-xs text-purple-600">Meta de Lucro</span>
                <p className="text-sm font-medium text-purple-700">Anual</p>
              </div>
              <span className="text-sm font-bold text-purple-600">
                R$ {metaLucroAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}