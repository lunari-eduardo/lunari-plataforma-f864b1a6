import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Package, HardDrive, Layers, Info, Sparkles, Tag, Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Types ──────────────────────────────────────────────────────────

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

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  active: boolean;
  sort_order: number;
  description: string | null;
}

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  applies_to: string;
  plan_codes: string[];
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

// ─── Config ─────────────────────────────────────────────────────────

const FAMILY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  studio: { label: 'Studio', icon: <Package size={16} />, color: 'text-lunar-accent' },
  transfer: { label: 'Transfer', icon: <HardDrive size={16} />, color: 'text-blue-400' },
  combo: { label: 'Combos', icon: <Layers size={16} />, color: 'text-purple-400' },
};

// ─── Helpers ────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────

export default function AdminPlanos() {
  const [plans, setPlans] = useState<UnifiedPlan[]>([]);
  const [editedPlans, setEditedPlans] = useState<Record<string, Partial<UnifiedPlan>>>({});
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [editedCredits, setEditedCredits] = useState<Record<string, Partial<CreditPackage>>>({});
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewCoupon, setShowNewCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    applies_to: 'all',
    max_uses: '' as string | number,
    valid_until: '',
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [plansRes, creditsRes, couponsRes] = await Promise.all([
      supabase.from('unified_plans').select('*').order('sort_order'),
      supabase.from('gallery_credit_packages').select('*').order('sort_order'),
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    ]);

    if (plansRes.error) toast.error('Erro ao carregar planos: ' + plansRes.error.message);
    if (creditsRes.error) toast.error('Erro ao carregar créditos: ' + creditsRes.error.message);
    if (couponsRes.error) toast.error('Erro ao carregar cupons: ' + couponsRes.error.message);

    setPlans((plansRes.data as unknown as UnifiedPlan[]) || []);
    setCreditPackages((creditsRes.data as unknown as CreditPackage[]) || []);
    setCoupons((couponsRes.data as unknown as Coupon[]) || []);
    setEditedPlans({});
    setEditedCredits({});
    setLoading(false);
  };

  // ─── Plan editing ───

  const updateField = (planId: string, field: keyof UnifiedPlan, value: any) => {
    setEditedPlans(prev => ({ ...prev, [planId]: { ...prev[planId], [field]: value } }));
  };

  const getFieldValue = (plan: UnifiedPlan, field: keyof UnifiedPlan) => {
    return editedPlans[plan.id]?.[field] ?? plan[field];
  };

  // ─── Credit editing ───

  const updateCreditField = (id: string, field: keyof CreditPackage, value: any) => {
    setEditedCredits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const getCreditFieldValue = (pkg: CreditPackage, field: keyof CreditPackage) => {
    return editedCredits[pkg.id]?.[field] ?? pkg[field];
  };

  // ─── Has changes ───

  const hasChanges = Object.keys(editedPlans).length > 0 || Object.keys(editedCredits).length > 0;

  // ─── Save all ───

  const handleSave = async () => {
    setSaving(true);
    try {
      const planUpdates = Object.entries(editedPlans);
      for (const [planId, changes] of planUpdates) {
        const { error } = await supabase
          .from('unified_plans')
          .update({ ...changes, updated_at: new Date().toISOString() } as any)
          .eq('id', planId);
        if (error) throw error;
      }

      const creditUpdates = Object.entries(editedCredits);
      for (const [id, changes] of creditUpdates) {
        const { error } = await supabase
          .from('gallery_credit_packages')
          .update({ ...changes, updated_at: new Date().toISOString() } as any)
          .eq('id', id);
        if (error) throw error;
      }

      const total = planUpdates.length + creditUpdates.length;
      toast.success(`${total} item(s) atualizado(s) com sucesso`);
      await fetchAll();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Coupon CRUD ───

  const handleCreateCoupon = async () => {
    if (!newCoupon.code.trim()) {
      toast.error('Código do cupom é obrigatório');
      return;
    }
    try {
      const { error } = await supabase.from('coupons').insert({
        code: newCoupon.code.trim().toUpperCase(),
        description: newCoupon.description || null,
        discount_type: newCoupon.discount_type,
        discount_value: newCoupon.discount_value,
        applies_to: newCoupon.applies_to,
        max_uses: newCoupon.max_uses ? Number(newCoupon.max_uses) : null,
        valid_until: newCoupon.valid_until || null,
      } as any);
      if (error) throw error;
      toast.success('Cupom criado com sucesso');
      setShowNewCoupon(false);
      setNewCoupon({ code: '', description: '', discount_type: 'percentage', discount_value: 10, applies_to: 'all', max_uses: '', valid_until: '' });
      await fetchAll();
    } catch (err: any) {
      toast.error('Erro ao criar cupom: ' + err.message);
    }
  };

  const toggleCoupon = async (coupon: Coupon) => {
    const { error } = await supabase
      .from('coupons')
      .update({ is_active: !coupon.is_active, updated_at: new Date().toISOString() } as any)
      .eq('id', coupon.id);
    if (error) {
      toast.error('Erro: ' + error.message);
      return;
    }
    await fetchAll();
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (coupon.current_uses > 0) {
      toast.error('Não é possível excluir cupom já utilizado. Desative-o.');
      return;
    }
    const { error } = await supabase.from('coupons').delete().eq('id', coupon.id);
    if (error) {
      toast.error('Erro: ' + error.message);
      return;
    }
    toast.success('Cupom excluído');
    await fetchAll();
  };

  // ─── Render ───

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
            Gerencie preços, créditos e cupons do ecossistema Lunari
          </p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || saving} size="sm" className="gap-2">
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
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{config.label}</h2>
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
                      {family === 'transfer' && <th className="text-right px-3 py-2 font-medium">GB</th>}
                      {family === 'combo' && <th className="text-right px-3 py-2 font-medium">Créditos</th>}
                      <th className="text-center px-3 py-2 font-medium">Ativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyPlans.map(plan => (
                      <tr key={plan.id} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <Input value={getFieldValue(plan, 'name') as string} onChange={e => updateField(plan.id, 'name', e.target.value)} className="h-7 text-xs w-44" />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground font-mono">{plan.code}</td>
                        <td className="px-3 py-2 text-right">
                          <Input value={centsToReais(getFieldValue(plan, 'monthly_price_cents') as number)} onChange={e => updateField(plan.id, 'monthly_price_cents', reaisToCents(e.target.value))} className="h-7 text-xs w-24 text-right ml-auto" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input value={centsToReais(getFieldValue(plan, 'yearly_price_cents') as number)} onChange={e => updateField(plan.id, 'yearly_price_cents', reaisToCents(e.target.value))} className="h-7 text-xs w-24 text-right ml-auto" />
                        </td>
                        {family === 'transfer' && (
                          <td className="px-3 py-2 text-right">
                            <Input value={bytesToGB(getFieldValue(plan, 'transfer_storage_bytes') as number)} onChange={e => updateField(plan.id, 'transfer_storage_bytes', gbToBytes(e.target.value))} className="h-7 text-xs w-16 text-right ml-auto" />
                          </td>
                        )}
                        {family === 'combo' && (
                          <td className="px-3 py-2 text-right">
                            <Input type="number" value={getFieldValue(plan, 'select_credits_monthly') as number} onChange={e => updateField(plan.id, 'select_credits_monthly', parseInt(e.target.value) || 0)} className="h-7 text-xs w-20 text-right ml-auto" />
                          </td>
                        )}
                        <td className="px-3 py-2 text-center">
                          <Switch checked={getFieldValue(plan, 'is_active') as boolean} onCheckedChange={v => updateField(plan.id, 'is_active', v)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}

      {/* ─── Credit Packages ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-amber-400"><Sparkles size={16} /></span>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Créditos Select</h2>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Nome</th>
                  <th className="text-right px-3 py-2 font-medium">Créditos</th>
                  <th className="text-right px-3 py-2 font-medium">Preço (R$)</th>
                  <th className="text-center px-3 py-2 font-medium">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {creditPackages.map(pkg => (
                  <tr key={pkg.id} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Input value={getCreditFieldValue(pkg, 'name') as string} onChange={e => updateCreditField(pkg.id, 'name', e.target.value)} className="h-7 text-xs w-44" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" value={getCreditFieldValue(pkg, 'credits') as number} onChange={e => updateCreditField(pkg.id, 'credits', parseInt(e.target.value) || 0)} className="h-7 text-xs w-20 text-right ml-auto" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input value={centsToReais(getCreditFieldValue(pkg, 'price_cents') as number)} onChange={e => updateCreditField(pkg.id, 'price_cents', reaisToCents(e.target.value))} className="h-7 text-xs w-24 text-right ml-auto" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch checked={getCreditFieldValue(pkg, 'active') as boolean} onCheckedChange={v => updateCreditField(pkg.id, 'active', v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Coupons ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-400"><Tag size={16} /></span>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Cupons de Desconto</h2>
          </div>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setShowNewCoupon(!showNewCoupon)}>
            <Plus size={12} />
            Novo Cupom
          </Button>
        </div>

        {/* New coupon form */}
        {showNewCoupon && (
          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Código</Label>
                <Input value={newCoupon.code} onChange={e => setNewCoupon(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="EX: PROMO10" className="h-8 text-xs uppercase" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={newCoupon.discount_type} onValueChange={v => setNewCoupon(p => ({ ...p, discount_type: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed_cents">Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor</Label>
                <Input type="number" value={newCoupon.discount_value} onChange={e => setNewCoupon(p => ({ ...p, discount_value: parseInt(e.target.value) || 0 }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aplica-se a</Label>
                <Select value={newCoupon.applies_to} onValueChange={v => setNewCoupon(p => ({ ...p, applies_to: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="combo">Combos</SelectItem>
                    <SelectItem value="credits">Créditos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Descrição</Label>
                <Input value={newCoupon.description} onChange={e => setNewCoupon(p => ({ ...p, description: e.target.value }))} placeholder="Opcional" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Limite de usos</Label>
                <Input type="number" value={newCoupon.max_uses} onChange={e => setNewCoupon(p => ({ ...p, max_uses: e.target.value }))} placeholder="Ilimitado" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Válido até</Label>
                <Input type="date" value={newCoupon.valid_until} onChange={e => setNewCoupon(p => ({ ...p, valid_until: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="flex items-end">
                <Button size="sm" className="w-full h-8 text-xs" onClick={handleCreateCoupon}>Criar Cupom</Button>
              </div>
            </div>
          </div>
        )}

        {/* Coupons list */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Código</th>
                  <th className="text-left px-3 py-2 font-medium">Desconto</th>
                  <th className="text-left px-3 py-2 font-medium">Aplica-se a</th>
                  <th className="text-right px-3 py-2 font-medium">Usos</th>
                  <th className="text-left px-3 py-2 font-medium">Validade</th>
                  <th className="text-center px-3 py-2 font-medium">Ativo</th>
                  <th className="text-center px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Nenhum cupom criado</td></tr>
                )}
                {coupons.map(coupon => (
                  <tr key={coupon.id} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono font-semibold">{coupon.code}</td>
                    <td className="px-3 py-2">
                      {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `R$ ${centsToReais(coupon.discount_value)}`}
                    </td>
                    <td className="px-3 py-2 capitalize">{coupon.applies_to === 'all' ? 'Todos' : coupon.applies_to}</td>
                    <td className="px-3 py-2 text-right">
                      {coupon.current_uses}{coupon.max_uses !== null ? ` / ${coupon.max_uses}` : ''}
                    </td>
                    <td className="px-3 py-2">
                      {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString('pt-BR') : 'Sem limite'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch checked={coupon.is_active} onCheckedChange={() => toggleCoupon(coupon)} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteCoupon(coupon)}>
                        <Trash2 size={12} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Capabilities matrix */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Capabilities por Plano</h2>
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
                  <td className="px-3 py-2 text-right">{plan.transfer_storage_bytes ? `${bytesToGB(plan.transfer_storage_bytes)} GB` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
