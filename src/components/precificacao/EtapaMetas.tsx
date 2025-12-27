import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Target, TrendingUp, Calculator, Calendar } from 'lucide-react';
import { usePricing } from '@/contexts/PricingContext';
import { EtapaColapsavel } from './EtapaColapsavel';

interface EtapaMetasProps {
  custosFixosTotal: number;
}

export function EtapaMetas({ custosFixosTotal }: EtapaMetasProps) {
  const { metas, atualizarMetas, statusSalvamento } = usePricing();
  
  const margemLucroDesejada = metas?.margemLucroDesejada ?? 30;

  // Cálculos (mantidos exatamente iguais)
  const faturamentoMinimoAnual = custosFixosTotal * 12;
  const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - margemLucroDesejada / 100);
  const metaFaturamentoMensal = metaFaturamentoAnual / 12;
  const metaLucroAnual = metaFaturamentoAnual - faturamentoMinimoAnual;
  const metaLucroMensal = metaLucroAnual / 12;
  
  // Valores mensais derivados
  const faturamentoMinimoMensal = faturamentoMinimoAnual / 12;

  // Atualizar metas no Supabase quando a margem mudar
  const handleMargemChange = (novaMargem: number) => {
    const currentYear = new Date().getFullYear();
    const novoFaturamentoMinimo = custosFixosTotal * 12;
    const novoMetaFaturamento = novoFaturamentoMinimo / (1 - novaMargem / 100);
    const novoMetaLucro = novoMetaFaturamento - novoFaturamentoMinimo;
    
    atualizarMetas({
      margemLucroDesejada: novaMargem,
      ano: currentYear,
      metaFaturamentoAnual: novoMetaFaturamento,
      metaLucroAnual: novoMetaLucro
    });
  };

  // Sincronizar metas quando custosFixosTotal mudar
  useEffect(() => {
    if (metas && custosFixosTotal > 0) {
      const currentYear = new Date().getFullYear();
      atualizarMetas({
        ...metas,
        ano: currentYear,
        metaFaturamentoAnual,
        metaLucroAnual
      });
    }
  }, [custosFixosTotal]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <EtapaColapsavel
      numero={2}
      titulo="Suas Metas Financeiras"
      descricao="Defina sua margem de lucro e veja suas metas de faturamento"
      defaultOpen={false}
      statusSalvamento={statusSalvamento}
    >
      <Card className="border shadow-lg bg-white dark:bg-card overflow-hidden">
        {/* NÍVEL 1: Entrada do Usuário */}
        <div className="p-5 border-b border-border/50">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-semibold">
                  Qual margem de lucro você deseja?
                </Label>
                <p className="text-sm text-muted-foreground">
                  Percentual do faturamento que se tornará lucro líquido
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="80"
                  value={margemLucroDesejada}
                  onChange={(e) => handleMargemChange(Number(e.target.value))}
                  className="w-20 h-10 text-center text-lg font-bold"
                />
                <span className="text-lg font-medium">%</span>
              </div>
            </div>
            
            <Slider
              value={[margemLucroDesejada]}
              onValueChange={(v) => handleMargemChange(v[0])}
              max={80}
              step={5}
              className="w-full"
            />
          </div>
        </div>

        {/* NÍVEL 2: Metas Anuais */}
        <div className="p-5 border-b border-border/50 bg-muted/10">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Metas Anuais
            </h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Faturamento Mínimo</span>
              <p className="text-lg font-bold">{formatCurrency(faturamentoMinimoAnual)}</p>
              <span className="text-xs text-muted-foreground">para cobrir custos</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Meta de Faturamento</span>
              <p className="text-lg font-bold">{formatCurrency(metaFaturamentoAnual)}</p>
              <span className="text-xs text-muted-foreground">custos + margem</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Meta de Lucro</span>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(metaLucroAnual)}
              </p>
              <span className="text-xs text-muted-foreground">lucro líquido</span>
            </div>
          </div>
        </div>

        {/* NÍVEL 3: Metas Mensais */}
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Metas Mensais
            </h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Faturamento Mínimo</span>
              <p className="text-lg font-bold">{formatCurrency(faturamentoMinimoMensal)}</p>
              <span className="text-xs text-muted-foreground">para cobrir custos</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Meta de Faturamento</span>
              <p className="text-lg font-bold">{formatCurrency(metaFaturamentoMensal)}</p>
              <span className="text-xs text-muted-foreground">custos + margem</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Meta de Lucro</span>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(metaLucroMensal)}
              </p>
              <span className="text-xs text-muted-foreground">lucro líquido</span>
            </div>
          </div>
        </div>

        {/* RESUMO FINAL EM DESTAQUE */}
        <div className="p-5 bg-primary/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Para atingir sua margem de <span className="font-semibold text-foreground">{margemLucroDesejada}%</span>, você precisa faturar:
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(metaFaturamentoMensal)}
              </p>
              <p className="text-sm text-muted-foreground">por mês</p>
            </div>
          </div>
        </div>
      </Card>
    </EtapaColapsavel>
  );
}
