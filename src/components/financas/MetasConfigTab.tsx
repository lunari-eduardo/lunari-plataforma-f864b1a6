import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Target, ArrowDownToLine, Loader2, Plus, Trash2, Save } from 'lucide-react';
import { useMetasPersonalizadas } from '@/hooks/useMetasPersonalizadas';
import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { cn } from '@/lib/utils';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MESES_CURTO = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export default function MetasConfigTab() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-based
  const [anoSelecionado, setAnoSelecionado] = useState(currentYear);
  const [mesSelecionado, setMesSelecionado] = useState(currentMonth);
  const { toast } = useToast();
  const { categorias } = useRealtimeConfiguration();

  const {
    metas,
    metasPorCategoria,
    usarPersonalizadas,
    loading,
    toggleUsarPersonalizadas,
    salvarTodasMetas,
    salvarMetaCategoria,
    removerMetaCategoria
  } = useMetasPersonalizadas(anoSelecionado);

  const [metasLocal, setMetasLocal] = useState<{ faturamento: string; lucro: string }[]>(
    Array.from({ length: 12 }, () => ({ faturamento: '', lucro: '' }))
  );
  const [saving, setSaving] = useState(false);

  // Category goals local state for selected month
  const [catGoalsLocal, setCatGoalsLocal] = useState<{ categoriaId: string; faturamento: string; lucro: string }[]>([]);

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

  // Sync category goals for selected month
  useEffect(() => {
    const mesNum = mesSelecionado + 1;
    const catMetas = metasPorCategoria.filter(m => m.mes === mesNum);
    setCatGoalsLocal(catMetas.map(m => ({
      categoriaId: m.categoria,
      faturamento: String(Number(m.meta_faturamento)),
      lucro: String(Number(m.meta_lucro))
    })));
  }, [mesSelecionado, metasPorCategoria]);

  const preencherComPrecificacao = () => {
    const annual = GoalsIntegrationService.getAnnualGoals();
    const fatMensal = Math.round((annual.revenue / 12) * 100) / 100;
    const lucMensal = Math.round((annual.profit / 12) * 100) / 100;
    setMetasLocal(prev => prev.map(() => ({
      faturamento: String(fatMensal),
      lucro: String(lucMensal)
    })));
  };

  const aplicarParaTodos = () => {
    const ref = metasLocal[mesSelecionado];
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

      // Save category goals for current month
      const mesNum = mesSelecionado + 1;
      for (const cg of catGoalsLocal) {
        await salvarMetaCategoria(mesNum, cg.categoriaId, parseFloat(cg.faturamento) || 0, parseFloat(cg.lucro) || 0);
      }

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

  const annualGoals = GoalsIntegrationService.getAnnualGoals();
  const hasGoals = annualGoals.revenue > 0 || annualGoals.profit > 0;

  const addCategoriaGoal = () => {
    const usedIds = catGoalsLocal.map(c => c.categoriaId);
    const available = categorias.filter(c => !usedIds.includes(c.id));
    if (available.length === 0) return;
    setCatGoalsLocal(prev => [...prev, { categoriaId: available[0].id, faturamento: '', lucro: '' }]);
  };

  const removeCategoriaGoal = async (index: number) => {
    const item = catGoalsLocal[index];
    await removerMetaCategoria(mesSelecionado + 1, item.categoriaId);
    setCatGoalsLocal(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalAnualFat = metasLocal.reduce((s, m) => s + (parseFloat(m.faturamento) || 0), 0);
  const totalAnualLuc = metasLocal.reduce((s, m) => s + (parseFloat(m.lucro) || 0), 0);

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
          <div className="flex gap-6 text-sm flex-wrap">
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

      {/* Main content - 2 column layout */}
      {usarPersonalizadas && (
        <div className="space-y-4">
          {/* Quick actions + year */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={preencherComPrecificacao} disabled={!hasGoals}>
                <ArrowDownToLine className="h-3.5 w-3.5 mr-1" />
                Preencher com precificação
              </Button>
              <Button variant="outline" size="sm" onClick={aplicarParaTodos}>
                Aplicar para todos os meses
              </Button>
            </div>
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
          </div>

          {/* 2-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-[25%_1fr] gap-4">
            {/* Left: month navigation */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="p-2 bg-muted/30 text-xs font-medium text-muted-foreground text-center">
                Meses
              </div>
              <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible">
                {MESES.map((nome, i) => {
                  const hasValue = !!(parseFloat(metasLocal[i].faturamento) || parseFloat(metasLocal[i].lucro));
                  return (
                    <button
                      key={i}
                      onClick={() => setMesSelecionado(i)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2.5 text-sm transition-colors border-b border-border/30 last:border-b-0 w-full min-w-[100px] md:min-w-0',
                        mesSelecionado === i
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted/40 text-foreground'
                      )}
                    >
                      <span className="hidden md:inline">{nome}</span>
                      <span className="md:hidden">{MESES_CURTO[i]}</span>
                      {hasValue && (
                        <span className="w-2 h-2 rounded-full bg-primary/60 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: form for selected month */}
            <div className="space-y-4">
              {/* Month header */}
              <div className="border border-border rounded-lg p-5 space-y-4">
                <h3 className="text-base font-semibold text-foreground">
                  {MESES[mesSelecionado]} {anoSelecionado}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Meta de Faturamento</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={metasLocal[mesSelecionado].faturamento}
                      onChange={(e) => {
                        const novo = [...metasLocal];
                        novo[mesSelecionado] = { ...novo[mesSelecionado], faturamento: e.target.value };
                        setMetasLocal(novo);
                      }}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Meta de Lucro</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={metasLocal[mesSelecionado].lucro}
                      onChange={(e) => {
                        const novo = [...metasLocal];
                        novo[mesSelecionado] = { ...novo[mesSelecionado], lucro: e.target.value };
                        setMetasLocal(novo);
                      }}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Category goals */}
              {categorias.length > 0 && (
                <div className="border border-border rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">Metas por Categoria</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={addCategoriaGoal}
                      disabled={catGoalsLocal.length >= categorias.length}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {catGoalsLocal.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma meta por categoria definida para este mês. Adicione para definir objetivos específicos.
                    </p>
                  )}

                  {catGoalsLocal.map((cg, idx) => {
                    const cat = categorias.find(c => c.id === cg.categoriaId);
                    const usedIds = catGoalsLocal.map(c => c.categoriaId);
                    const availableCats = categorias.filter(c => c.id === cg.categoriaId || !usedIds.includes(c.id));

                    return (
                      <div key={idx} className="flex items-end gap-2">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground">Categoria</Label>
                          <select
                            value={cg.categoriaId}
                            onChange={(e) => {
                              const updated = [...catGoalsLocal];
                              updated[idx] = { ...updated[idx], categoriaId: e.target.value };
                              setCatGoalsLocal(updated);
                            }}
                            className="w-full bg-background border border-input rounded-md px-2 py-2 text-sm"
                          >
                            {availableCats.map(c => (
                              <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5 w-28">
                          <Label className="text-xs text-muted-foreground">Faturamento</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={cg.faturamento}
                            onChange={(e) => {
                              const updated = [...catGoalsLocal];
                              updated[idx] = { ...updated[idx], faturamento: e.target.value };
                              setCatGoalsLocal(updated);
                            }}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1.5 w-28">
                          <Label className="text-xs text-muted-foreground">Lucro</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={cg.lucro}
                            onChange={(e) => {
                              const updated = [...catGoalsLocal];
                              updated[idx] = { ...updated[idx], lucro: e.target.value };
                              setCatGoalsLocal(updated);
                            }}
                            className="text-sm"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          onClick={() => removeCategoriaGoal(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Annual summary */}
              <div className="bg-muted/20 border border-border/50 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Resumo Anual</p>
                <div className="flex gap-6 text-sm flex-wrap">
                  <div>
                    <span className="text-muted-foreground">Faturamento: </span>
                    <span className="font-semibold text-foreground">{formatCurrency(totalAnualFat)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lucro: </span>
                    <span className="font-semibold text-foreground">{formatCurrency(totalAnualLuc)}</span>
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button onClick={handleSalvar} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar metas
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inactive state */}
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
