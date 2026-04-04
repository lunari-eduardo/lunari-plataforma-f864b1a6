import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Target, ArrowDownToLine, Loader2, Plus, Trash2, Save, Calendar, Tag } from 'lucide-react';
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

/** Format number to BRL display (without R$): 1234.5 → "1.234,50" */
function formatToBRL(value: number): string {
  if (!value || value === 0) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Parse BRL formatted string to number: "1.234,50" → 1234.5 */
function parseBRL(formatted: string): number {
  if (!formatted) return 0;
  const clean = formatted.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

/** Handle BRL input masking in real-time */
function maskBRLInput(raw: string): string {
  // Remove everything except digits and comma
  let cleaned = raw.replace(/[^\d,]/g, '');
  
  // Only allow one comma
  const parts = cleaned.split(',');
  if (parts.length > 2) {
    cleaned = parts[0] + ',' + parts.slice(1).join('');
  }
  
  // Limit decimal to 2 digits
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + ',' + parts[1].slice(0, 2);
  }
  
  // Add thousand separators to integer part
  const [intPart, decPart] = cleaned.split(',');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return decPart !== undefined ? `${formatted},${decPart}` : formatted;
}

export default function MetasConfigTab() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [anoSelecionado, setAnoSelecionado] = useState(currentYear);
  const [mesSelecionado, setMesSelecionado] = useState(currentMonth);
  const { toast } = useToast();
  const { categorias } = useRealtimeConfiguration();

  const {
    metas,
    metasPorCategoria,
    usarPersonalizadas,
    modoMetas,
    loading,
    toggleUsarPersonalizadas,
    setModoMetas,
    salvarTodasMetas,
    salvarMetaCategoria,
    removerMetaCategoria
  } = useMetasPersonalizadas(anoSelecionado);

  // Monthly goals local state (faturamento only)
  const [metasLocal, setMetasLocal] = useState<{ faturamento: string }[]>(
    Array.from({ length: 12 }, () => ({ faturamento: '' }))
  );
  const [saving, setSaving] = useState(false);

  // Category goals local state (annual, mes=0)
  const [catGoalsLocal, setCatGoalsLocal] = useState<{ categoriaId: string; faturamento: string }[]>([]);

  // Sync monthly goals
  useEffect(() => {
    const novoLocal = Array.from({ length: 12 }, (_, i) => {
      const meta = metas.find(m => m.mes === i + 1);
      return {
        faturamento: meta ? formatToBRL(Number(meta.meta_faturamento)) : ''
      };
    });
    setMetasLocal(novoLocal);
  }, [metas]);

  // Sync category goals (mes=0 for annual)
  useEffect(() => {
    const catMetas = metasPorCategoria.filter(m => m.mes === 0);
    setCatGoalsLocal(catMetas.map(m => ({
      categoriaId: m.categoria,
      faturamento: formatToBRL(Number(m.meta_faturamento))
    })));
  }, [metasPorCategoria]);

  const preencherComPrecificacao = () => {
    const annual = GoalsIntegrationService.getAnnualGoals();
    const fatMensal = Math.round((annual.revenue / 12) * 100) / 100;
    setMetasLocal(prev => prev.map(() => ({
      faturamento: formatToBRL(fatMensal)
    })));
  };

  const aplicarParaTodos = () => {
    const ref = metasLocal[mesSelecionado];
    setMetasLocal(prev => prev.map(() => ({ ...ref })));
  };

  const handleSalvarMensal = async () => {
    setSaving(true);
    try {
      const metasArray = metasLocal.map((m, i) => ({
        mes: i + 1,
        meta_faturamento: parseBRL(m.faturamento),
        meta_lucro: 0
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

  const handleSalvarCategorias = async () => {
    setSaving(true);
    try {
      for (const cg of catGoalsLocal) {
        await salvarMetaCategoria(0, cg.categoriaId, parseBRL(cg.faturamento), 0);
      }
      toast({ title: 'Metas por categoria salvas!' });
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
  const hasGoals = annualGoals.revenue > 0;

  const addCategoriaGoal = () => {
    const usedIds = catGoalsLocal.map(c => c.categoriaId);
    const available = categorias.filter(c => !usedIds.includes(c.id));
    if (available.length === 0) return;
    setCatGoalsLocal(prev => [...prev, { categoriaId: available[0].id, faturamento: '' }]);
  };

  const removeCategoriaGoal = async (index: number) => {
    const item = catGoalsLocal[index];
    await removerMetaCategoria(0, item.categoriaId);
    setCatGoalsLocal(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalAnualFat = metasLocal.reduce((s, m) => s + parseBRL(m.faturamento), 0);
  const totalCatFat = catGoalsLocal.reduce((s, c) => s + parseBRL(c.faturamento), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Target className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Metas de Faturamento</h2>
          <p className="text-sm text-muted-foreground">
            Configure suas metas mensais ou por categoria
          </p>
        </div>
      </div>

      {/* Referência da precificação */}
      {hasGoals && (
        <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">📊 Referência da precificação</p>
          <div className="flex gap-6 text-sm flex-wrap">
            <div>
              <span className="text-muted-foreground">Faturamento anual: </span>
              <span className="font-semibold text-foreground">{formatCurrency(annualGoals.revenue)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Faturamento mensal: </span>
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
              ? 'Suas metas customizadas serão usadas na análise de vendas'
              : 'Usando metas automáticas da precificação'
            }
          </p>
        </div>
        <Switch
          checked={usarPersonalizadas}
          onCheckedChange={toggleUsarPersonalizadas}
        />
      </div>

      {usarPersonalizadas && (
        <div className="space-y-4">
          {/* Mode selector */}
          <div className="flex gap-2">
            <Button
              variant={modoMetas === 'mensal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setModoMetas('mensal')}
              className="flex items-center gap-2"
            >
              <Calendar className="h-3.5 w-3.5" />
              Por Meses
            </Button>
            <Button
              variant={modoMetas === 'categoria' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setModoMetas('categoria')}
              className="flex items-center gap-2"
            >
              <Tag className="h-3.5 w-3.5" />
              Por Categorias
            </Button>
          </div>

          {/* Year selector */}
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

          {/* === MODO MENSAL === */}
          {modoMetas === 'mensal' && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={preencherComPrecificacao} disabled={!hasGoals}>
                  <ArrowDownToLine className="h-3.5 w-3.5 mr-1" />
                  Preencher com precificação
                </Button>
                <Button variant="outline" size="sm" onClick={aplicarParaTodos}>
                  Aplicar para todos os meses
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[25%_1fr] gap-4">
                {/* Left: month navigation */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="p-2 bg-muted/30 text-xs font-medium text-muted-foreground text-center">
                    Meses
                  </div>
                  <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible">
                    {MESES.map((nome, i) => {
                      const hasValue = parseBRL(metasLocal[i].faturamento) > 0;
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
                  <div className="border border-border rounded-lg p-5 space-y-4">
                    <h3 className="text-base font-semibold text-foreground">
                      {MESES[mesSelecionado]} {anoSelecionado}
                    </h3>
                    <div className="space-y-1.5 max-w-xs">
                      <Label className="text-xs text-muted-foreground">Meta de Faturamento</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={metasLocal[mesSelecionado].faturamento}
                          onChange={(e) => {
                            const masked = maskBRLInput(e.target.value);
                            const novo = [...metasLocal];
                            novo[mesSelecionado] = { faturamento: masked };
                            setMetasLocal(novo);
                          }}
                          onFocus={(e) => e.target.select()}
                          className="text-sm pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Annual summary */}
                  <div className="bg-muted/20 border border-border/50 rounded-lg p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Resumo Anual</p>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total de Faturamento: </span>
                      <span className="font-semibold text-foreground">{formatCurrency(totalAnualFat)}</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSalvarMensal} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                      Salvar metas
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === MODO CATEGORIA === */}
          {modoMetas === 'categoria' && (
            <div className="space-y-4">
              <div className="border border-border rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Metas por Categoria</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Defina a meta de faturamento anual para cada tipo de sessão
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addCategoriaGoal}
                    disabled={catGoalsLocal.length >= categorias.length}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {catGoalsLocal.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma meta por categoria definida. Clique em "Adicionar" para começar.
                  </p>
                )}

                {catGoalsLocal.map((cg, idx) => {
                  const cat = categorias.find(c => c.id === cg.categoriaId);
                  const usedIds = catGoalsLocal.map(c => c.categoriaId);
                  const availableCats = categorias.filter(c => c.id === cg.categoriaId || !usedIds.includes(c.id));

                  return (
                    <div key={idx} className="flex items-end gap-3 p-3 bg-muted/20 rounded-lg">
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
                      <div className="space-y-1.5 w-44">
                        <Label className="text-xs text-muted-foreground">Meta de Faturamento (anual)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={cg.faturamento}
                            onChange={(e) => {
                              const masked = maskBRLInput(e.target.value);
                              const updated = [...catGoalsLocal];
                              updated[idx] = { ...updated[idx], faturamento: masked };
                              setCatGoalsLocal(updated);
                            }}
                            onFocus={(e) => e.target.select()}
                            className="text-sm pl-9"
                          />
                        </div>
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

              {/* Category summary */}
              <div className="bg-muted/20 border border-border/50 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Resumo</p>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total de Faturamento (categorias): </span>
                  <span className="font-semibold text-foreground">{formatCurrency(totalCatFat)}</span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSalvarCategorias} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar metas
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inactive state */}
      {!usarPersonalizadas && (
        <div className="text-center py-8 text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            As metas da <strong>precificação</strong> estão sendo usadas automaticamente.
          </p>
          <p className="text-xs mt-1">Ative as metas personalizadas para definir seus próprios objetivos.</p>
        </div>
      )}
    </div>
  );
}
