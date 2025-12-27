import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { TrendingUp, Target, DollarSign } from 'lucide-react';
import { MetasService, IndicadoresService } from '@/services/PricingService';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

interface EtapaMetasProps {
  custosFixosTotal: number;
}

export function EtapaMetas({ custosFixosTotal }: EtapaMetasProps) {
  const [margemLucroDesejada, setMargemLucroDesejada] = useState(30);

  // Carregar dados salvos
  useEffect(() => {
    try {
      const dados = MetasService.carregar();
      setMargemLucroDesejada(dados.margemLucroDesejada);
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    }
  }, []);

  // Cálculos
  const faturamentoMinimoAnual = custosFixosTotal * 12;
  const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - margemLucroDesejada / 100);
  const metaFaturamentoMensal = metaFaturamentoAnual / 12;
  const metaLucroAnual = metaFaturamentoAnual - faturamentoMinimoAnual;
  const metaLucroMensal = metaLucroAnual / 12;

  // Salvar automaticamente
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const currentYear = new Date().getFullYear();
        const dadosParaSalvar = {
          margemLucroDesejada,
          ano: currentYear,
          metaFaturamentoAnual,
          metaLucroAnual
        };
        MetasService.salvar(dadosParaSalvar);
        IndicadoresService.atualizarIndicador('metas', 'salvo', 'Salvo automaticamente');
        
        // Salvar histórico
        const historicalGoals = storage.load(STORAGE_KEYS.HISTORICAL_GOALS, []);
        const existingIdx = historicalGoals.findIndex((g: any) => g.ano === currentYear);
        const newGoal = {
          ano: currentYear,
          metaFaturamento: metaFaturamentoAnual,
          metaLucro: metaLucroAnual,
          dataCriacao: new Date().toISOString().split('T')[0],
          margemLucroDesejada
        };
        if (existingIdx !== -1) {
          historicalGoals[existingIdx] = newGoal;
        } else {
          historicalGoals.push(newGoal);
        }
        storage.save(STORAGE_KEYS.HISTORICAL_GOALS, historicalGoals);
      } catch (error) {
        console.error('Erro ao salvar metas:', error);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [margemLucroDesejada, custosFixosTotal, metaFaturamentoAnual, metaLucroAnual]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 font-bold">
          2
        </div>
        <div>
          <h2 className="text-lg font-semibold">Suas Metas Financeiras</h2>
          <p className="text-sm text-muted-foreground">
            Defina quanto lucro você quer ter no seu negócio
          </p>
        </div>
      </div>
      
      <Card className="shadow-md border-2">
        <CardContent className="p-6 space-y-6">
          {/* Slider de Margem */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                Qual margem de lucro você deseja?
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="80"
                  value={margemLucroDesejada}
                  onChange={(e) => setMargemLucroDesejada(Number(e.target.value))}
                  className="w-20 h-10 text-center text-lg font-bold"
                />
                <span className="text-lg font-medium">%</span>
              </div>
            </div>
            
            <Slider
              value={[margemLucroDesejada]}
              onValueChange={(v) => setMargemLucroDesejada(v[0])}
              max={80}
              step={5}
              className="w-full"
            />
          </div>
          
          {/* Feedback Dinâmico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300">Meta Mensal</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(metaFaturamentoMensal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                para cobrir custos + lucro desejado
              </p>
            </div>
            
            <div className="rounded-lg p-4 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <span className="text-sm text-purple-700 dark:text-purple-300">Lucro Anual Estimado</span>
              </div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(metaLucroAnual)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(metaLucroMensal)}/mês
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
