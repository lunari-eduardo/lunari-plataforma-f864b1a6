import { useState, useEffect } from 'react';
import { Settings, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { usePricingSupabaseData } from '@/hooks/pricing/usePricingSupabaseData';

export function ConfigurarMetasModal() {
  const [open, setOpen] = useState(false);
  const { metas, atualizarMetas, estruturaCustos } = usePricingSupabaseData();

  const margemAtual = metas?.margemLucroDesejada ?? 30;
  
  const handleMargemChange = (novaMargem: number) => {
    if (!metas) return;
    
    // Obter custos totais da estrutura de custos (ou 0 se não existir)
    const custosFixosTotal = estruturaCustos?.totalCalculado || 0;
    
    const currentYear = new Date().getFullYear();
    const faturamentoMinimoAnual = custosFixosTotal * 12;
    const novoMetaFaturamento = faturamentoMinimoAnual / (1 - novaMargem / 100);
    const novoMetaLucro = novoMetaFaturamento - faturamentoMinimoAnual;
    
    atualizarMetas({
      ...metas,
      margemLucroDesejada: novaMargem,
      ano: currentYear,
      metaFaturamentoAnual: novoMetaFaturamento,
      metaLucroAnual: novoMetaLucro
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="p-1.5 text-muted-foreground/50 hover:text-foreground transition-colors rounded-md hover:bg-muted"
          aria-label="Configurar Metas"
          title="Configurar Metas"
        >
          <Settings className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configurar Metas</DialogTitle>
          <DialogDescription>
            Defina sua margem de lucro desejada para calcular as metas financeiras automaticamente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          <div className="rounded-lg border border-border/20 bg-card/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" style={{ color: 'hsl(var(--accent-gold))' }} />
                  Margem de lucro desejada
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Percentual do faturamento que vira lucro líquido
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Input
                  type="number"
                  min="0"
                  max="80"
                  value={margemAtual}
                  onChange={(e) => handleMargemChange(Number(e.target.value))}
                  className="w-16 h-8 text-center text-sm font-semibold tabular-nums"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>

            <Slider
              value={[margemAtual]}
              onValueChange={(v) => handleMargemChange(v[0])}
              max={80}
              step={5}
              className="w-full mt-6"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
