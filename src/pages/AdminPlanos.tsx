import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save, Package, HardDrive, Layers, Info } from 'lucide-react';

interface UnifiedPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  product_family: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  includes_studio: boolean;
  includes_select: boolean;
  includes_transfer: boolean;
  select_credits_monthly: number;
  transfer_storage_bytes: number;
  sort_order: number;
  is_active: boolean;
}

const FAMILY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  studio: { label: 'Studio', icon: <Package size={16} />, color: 'text-lunar-accent' },
  transfer: { label: 'Transfer', icon: <HardDrive size={16} />, color: 'text-blue-400' },
  combo: { label: 'Combos', icon: <Layers size={16} />, color: 'text-purple-400' },
};

function centsToReais(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function reaisToCents(reais: string): number {
  const cleaned = reais.replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

function bytesToGB(bytes: number): string {
  if (!bytes) return '0';
  return (bytes / (1024 * 1024 * 1024)).toFixed(0);
}

function gbToBytes(gb: string): number {
  const num = parseFloat(gb);
  return isNaN(num) ? 0 : Math.round(num * 1024 * 1024 * 1024);
}

export default function AdminPlanos() {
  const [plans, setPlans] = useState<UnifiedPlan[]>([]);
  const [editedPlans, setEditedPlans] = useState<Record<string, Partial<UnifiedPlan>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('unified_plans')
      .select('*')
      .order('sort_order');
    
    if (error) {
      toast.error('Erro ao carregar planos: ' + error.message);
      return;
    }
    setPlans((data as unknown as UnifiedPlan[]) || []);
    setEditedPlans({});
    setLoading(false);
  };

  const updateField = (planId: string, field: keyof UnifiedPlan, value: any) => {
    setEditedPlans(prev => ({
      ...prev,
      [planId]: { ...prev[planId], [field]: value },
    }));
  };

  const getFieldValue = (plan: UnifiedPlan, field: keyof UnifiedPlan) => {
    return editedPlans[plan.id]?.[field] ?? plan[field];
  };

  const hasChanges = Object.keys(editedPlans).length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(editedPlans);
      for (const [planId, changes] of updates) {
        const { error } = await supabase
          .from('unified_plans')
          .update({ ...changes, updated_at: new Date().toISOString() } as any)
          .eq('id', planId);
        if (error) throw error;
      }
      toast.success(`${updates.length} plano(s) atualizado(s) com sucesso`);
      await fetchPlans();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // No longer needed — unified_plans IS the source of truth now

  const grouped = plans.reduce<Record<string, UnifiedPlan[]>>((acc, plan) => {
    const family = plan.product_family || 'other';
    if (!acc[family]) acc[family] = [];
    acc[family].push(plan);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lunar-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Produtos & Planos</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Gerencie preços e configurações dos planos Lunari
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          size="sm"
          className="gap-2"
        >
          <Save size={14} />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Info size={16} className="text-primary mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground">
          Alterações nos preços aqui serão aplicadas <strong className="text-foreground">imediatamente</strong> no checkout e nas cobranças — sem necessidade de deploy.
        </div>
      </div>

      {/* Plan groups */}
      {['studio', 'transfer', 'combo'].map(family => {
        const familyPlans = grouped[family];
        if (!familyPlans?.length) return null;
        const config = FAMILY_CONFIG[family];

        return (
          <div key={family} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={config.color}>{config.icon}</span>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {config.label}
              </h2>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium">Plano</th>
                      <th className="text-left px-3 py-2 font-medium">Código</th>
                      <th className="text-right px-3 py-2 font-medium">Mensal (R$)</th>
                      <th className="text-right px-3 py-2 font-medium">Anual (R$)</th>
                      {family === 'transfer' && (
                        <th className="text-right px-3 py-2 font-medium">GB</th>
                      )}
                      {(family === 'combo') && (
                        <th className="text-right px-3 py-2 font-medium">Créditos</th>
                      )}
                      <th className="text-center px-3 py-2 font-medium">Ativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyPlans.map(plan => {
                      return (
                        <tr key={plan.id} className="border-t border-border/50 hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <Input
                              value={getFieldValue(plan, 'name') as string}
                              onChange={e => updateField(plan.id, 'name', e.target.value)}
                              className="h-7 text-xs w-44"
                            />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground font-mono">
                            {plan.code}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              value={centsToReais(getFieldValue(plan, 'monthly_price_cents') as number)}
                              onChange={e => updateField(plan.id, 'monthly_price_cents', reaisToCents(e.target.value))}
                              className="h-7 text-xs w-24 text-right ml-auto"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              value={centsToReais(getFieldValue(plan, 'yearly_price_cents') as number)}
                              onChange={e => updateField(plan.id, 'yearly_price_cents', reaisToCents(e.target.value))}
                              className="h-7 text-xs w-24 text-right ml-auto"
                            />
                          </td>
                          {family === 'transfer' && (
                            <td className="px-3 py-2 text-right">
                              <Input
                                value={bytesToGB(getFieldValue(plan, 'transfer_storage_bytes') as number)}
                                onChange={e => updateField(plan.id, 'transfer_storage_bytes', gbToBytes(e.target.value))}
                                className="h-7 text-xs w-16 text-right ml-auto"
                              />
                            </td>
                          )}
                          {family === 'combo' && (
                            <td className="px-3 py-2 text-right">
                              <Input
                                type="number"
                                value={getFieldValue(plan, 'select_credits_monthly') as number}
                                onChange={e => updateField(plan.id, 'select_credits_monthly', parseInt(e.target.value) || 0)}
                                className="h-7 text-xs w-20 text-right ml-auto"
                              />
                            </td>
                          )}
                          <td className="px-3 py-2 text-center">
                            <Switch
                              checked={getFieldValue(plan, 'is_active') as boolean}
                              onCheckedChange={v => updateField(plan.id, 'is_active', v)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}

      {/* Includes matrix */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Capabilities por Plano
        </h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Plano</th>
                <th className="text-center px-3 py-2 font-medium">Studio</th>
                <th className="text-center px-3 py-2 font-medium">Select</th>
                <th className="text-center px-3 py-2 font-medium">Transfer</th>
                <th className="text-right px-3 py-2 font-medium">Créditos/mês</th>
                <th className="text-right px-3 py-2 font-medium">Storage</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id} className="border-t border-border/50">
                  <td className="px-3 py-2 font-medium">{plan.name}</td>
                  <td className="px-3 py-2 text-center">{plan.includes_studio ? '✓' : '—'}</td>
                  <td className="px-3 py-2 text-center">{plan.includes_select ? '✓' : '—'}</td>
                  <td className="px-3 py-2 text-center">{plan.includes_transfer ? '✓' : '—'}</td>
                  <td className="px-3 py-2 text-right">{plan.select_credits_monthly || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {plan.transfer_storage_bytes ? `${bytesToGB(plan.transfer_storage_bytes)} GB` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
