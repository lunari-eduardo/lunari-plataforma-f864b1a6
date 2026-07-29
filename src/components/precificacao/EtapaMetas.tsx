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

  const linhas = [
    {
      label: 'Faturamento mínimo',
      hint: 'para cobrir custos',
      mensal: faturamentoMinimoMensal,
      anual: faturamentoMinimoAnual,
    },
    {
      label: 'Meta de faturamento',
      hint: 'custos + margem',
      mensal: metaFaturamentoMensal,
      anual: metaFaturamentoAnual,
      destaque: true,
    },
    {
      label: 'Meta de lucro',
      hint: 'lucro líquido',
      mensal: metaLucroMensal,
      anual: metaLucroAnual,
    },
  ];

  return (
    <EtapaColapsavel
      titulo="Metas financeiras"
      descricao="Defina sua margem de lucro e veja as metas resultantes"
      statusSalvamento={statusSalvamento}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Margem desejada */}
        <div className="rounded-lg border border-border/20 bg-card/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: 'hsl(var(--accent-gold))' }} />
                Margem de lucro desejada
              </Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                Percentual do faturamento que vira lucro líquido
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                type="number"
                min="0"
                max="80"
                value={margemLucroDesejada}
                onChange={(e) => handleMargemChange(Number(e.target.value))}
                className="w-16 h-8 text-center text-sm font-semibold tabular-nums"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>

          <Slider
            value={[margemLucroDesejada]}
            onValueChange={(v) => handleMargemChange(v[0])}
            max={80}
            step={5}
            className="w-full mt-4"
          />

          <div className="flex items-center justify-between border-t border-border/20 mt-4 pt-3">
            <div className="flex items-center gap-2 min-w-0">
              <Target className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--accent-gold))' }} />
              <span className="text-[11px] text-muted-foreground">
                Você precisa faturar por mês
              </span>
            </div>
            <span
              className="text-[19px] font-semibold tabular-nums"
              style={{ color: 'hsl(var(--accent-gold))' }}
            >
              {formatCurrency(metaFaturamentoMensal)}
            </span>
          </div>
        </div>

        {/* Metas mensais x anuais */}
        <div className="rounded-lg border border-border/20 bg-card/60 p-3">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4" style={{ color: 'hsl(var(--accent-gold))' }} />
            Metas resultantes
          </h3>

          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 mt-3 items-end">
            <span className="text-[11px] text-muted-foreground">&nbsp;</span>
            <span className="text-[11px] text-muted-foreground text-right">Mensal</span>
            <span className="text-[11px] text-muted-foreground text-right">Anual</span>

            {linhas.map((linha) => (
              <div key={linha.label} className="contents">
                <div className="min-w-0 border-t border-border/20 pt-2">
                  <p className="text-xs text-foreground truncate">{linha.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{linha.hint}</p>
                </div>
                <div className="text-right border-t border-border/20 pt-2">
                  <span className="text-[15px] font-semibold text-foreground tabular-nums">
                    {formatCurrency(linha.mensal)}
                  </span>
                </div>
                <div className="text-right border-t border-border/20 pt-2">
                  <span className="text-[13px] text-muted-foreground tabular-nums">
                    {formatCurrency(linha.anual)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Base: {formatCurrency(custosFixosTotal)} de custos fixos por mês
          </p>
        </div>
      </div>
    </EtapaColapsavel>
  );
}
