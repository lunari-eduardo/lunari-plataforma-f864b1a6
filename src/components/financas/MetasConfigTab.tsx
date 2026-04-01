import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Target, Copy, ArrowDownToLine, Loader2 } from 'lucide-react';
import { useMetasPersonalizadas } from '@/hooks/useMetasPersonalizadas';
import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function MetasConfigTab() {
  const currentYear = new Date().getFullYear();
  const [anoSelecionado, setAnoSelecionado] = useState(currentYear);
  const { toast } = useToast();
  
  const {
    metas,
    usarPersonalizadas,
    loading,
    toggleUsarPersonalizadas,
    salvarTodasMetas
  } = useMetasPersonalizadas(anoSelecionado);

  // Estado local para edição
  const [metasLocal, setMetasLocal] = useState<{ faturamento: string; lucro: string }[]>(
    Array.from({ length: 12 }, () => ({ faturamento: '', lucro: '' }))
  );
  const [saving, setSaving] = useState(false);

  // Sincronizar metas do banco com estado local
  useEffect(() => {
    const novoLocal = Array.from({ length: 12 }, (_, i) => {
      const meta = metas.find(m => m.mes === i + 1);
      return {
        faturamento: meta ? String(Number(meta.meta_faturamento)) : '',
        lucro: meta ? String(Number(meta.meta_lucro)) : ''
      };
    });
    setMetasLocal(novoLocal);
  }, [metas]);

  const preencherComPrecificacao = () => {
    const annual = GoalsIntegrationService.getAnnualGoals();
    const fatMensal = Math.round((annual.revenue / 12) * 100) / 100;
    const lucMensal = Math.round((annual.profit / 12) * 100) / 100;
    
    setMetasLocal(prev => prev.map(() => ({
      faturamento: String(fatMensal),
      lucro: String(lucMensal)
    })));
  };

  const aplicarParaTodos = (mesIndex: number) => {
    const ref = metasLocal[mesIndex];
    setMetasLocal(prev => prev.map(() => ({ ...ref })));
  };

  const handleSalvar = async () => {
    setSaving(true);
    try {
      const metasArray = metasLocal.map((m, i) => ({
        mes: i + 1,
        meta_faturamento: parseFloat(m.faturamento) || 0,
        meta_lucro: parseFloat(m.lucro) || 0
      }));

      const result = await salvarTodasMetas(metasArray);
      if (result?.error) {
        toast({ title: 'Erro ao salvar metas', variant: 'destructive' });
      } else {
        toast({ title: 'Metas salvas com sucesso!' });
      }
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Referência da precificação
  const annualGoals = GoalsIntegrationService.getAnnualGoals();
  const hasGoals = annualGoals.revenue > 0 || annualGoals.profit > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Target className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Metas de Faturamento e Lucro</h2>
          <p className="text-sm text-muted-foreground">
            Configure suas metas mensais ou use as metas calculadas na precificação
          </p>
        </div>
      </div>

      {/* Referência da precificação */}
      {hasGoals && (
        <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">📊 Referência da precificação</p>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Meta anual: </span>
              <span className="font-semibold text-foreground">{formatCurrency(annualGoals.revenue)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Lucro anual: </span>
              <span className="font-semibold text-foreground">{formatCurrency(annualGoals.profit)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Mensal: </span>
              <span className="font-semibold text-foreground">{formatCurrency(annualGoals.revenue / 12)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Toggle */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-4">
        <div>
          <Label className="text-sm font-medium text-foreground">
            Usar metas personalizadas
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {usarPersonalizadas 
              ? 'Suas metas mensais customizadas serão usadas na análise de vendas'
              : 'Usando metas automáticas da precificação'
            }
          </p>
        </div>
        <Switch 
          checked={usarPersonalizadas} 
          onCheckedChange={toggleUsarPersonalizadas} 
        />
      </div>

      {/* Lista de meses */}
      {usarPersonalizadas && (
        <div className="space-y-4">
          {/* Ações rápidas */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={preencherComPrecificacao}
              disabled={!hasGoals}
            >
              <ArrowDownToLine className="h-3.5 w-3.5 mr-1" />
              Preencher com precificação
            </Button>
          </div>

          {/* Ano selector */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Ano:</Label>
            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
              className="bg-background border border-input rounded-md px-2 py-1 text-sm"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Grid de meses */}
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[120px_1fr_1fr_40px] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
              <span>Mês</span>
              <span>Meta Faturamento</span>
              <span>Meta Lucro</span>
              <span></span>
            </div>

            {/* Rows */}
            {MESES.map((nomeMes, i) => (
              <div
                key={i}
                className="grid grid-cols-[120px_1fr_1fr_40px] gap-2 px-4 py-2 border-t border-border/30 items-center hover:bg-muted/20 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{nomeMes}</span>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={metasLocal[i].faturamento}
                  onChange={(e) => {
                    const novo = [...metasLocal];
                    novo[i] = { ...novo[i], faturamento: e.target.value };
                    setMetasLocal(novo);
                  }}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  placeholder="0,00"
                  value={metasLocal[i].lucro}
                  onChange={(e) => {
                    const novo = [...metasLocal];
                    novo[i] = { ...novo[i], lucro: e.target.value };
                    setMetasLocal(novo);
                  }}
                  className="h-8 text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => aplicarParaTodos(i)}
                  title="Aplicar para todos os meses"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Resumo + Salvar */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Total anual: {' '}
              <span className="font-semibold text-foreground">
                {formatCurrency(metasLocal.reduce((s, m) => s + (parseFloat(m.faturamento) || 0), 0))}
              </span>
              {' '} faturamento, {' '}
              <span className="font-semibold text-foreground">
                {formatCurrency(metasLocal.reduce((s, m) => s + (parseFloat(m.lucro) || 0), 0))}
              </span>
              {' '} lucro
            </div>
            <Button onClick={handleSalvar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar metas
            </Button>
          </div>
        </div>
      )}

      {/* Estado quando usando precificação */}
      {!usarPersonalizadas && (
        <div className="text-center py-8 text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            As metas da <strong>precificação</strong> estão sendo usadas automaticamente.
          </p>
          <p className="text-xs mt-1">
            Ative metas personalizadas para definir objetivos específicos por mês.
          </p>
        </div>
      )}
    </div>
  );
}
