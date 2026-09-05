import { useNavigate } from 'react-router-dom';
import { Check, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isSubActiveForPlan, getPlanHierarchyLevel } from '@/lib/transferPlans';
import { BillingToggle } from './BillingToggle';

interface CombosSectionProps {
  billingPeriod: 'monthly' | 'yearly';
  setBillingPeriod: (period: 'monthly' | 'yearly') => void;
  comboPlans: any[];
  allSubs: any[];
  formatPrice: (cents: number) => string;
  onSubscribe: (planType: string, planName: string, priceCents: number) => void;
}

export function CombosSection({
  billingPeriod,
  setBillingPeriod,
  comboPlans,
  allSubs,
  formatPrice,
  onSubscribe,
}: CombosSectionProps) {
  const navigate = useNavigate();

  return (
    <section className="container max-w-5xl pb-20 space-y-10">
      <div className="text-center space-y-3">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Cresça com uma estrutura completa
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Para quem quer integrar gestão, seleção e armazenamento em um único sistema profissional.
        </p>
      </div>

      {/* Toggle */}
      <div className="flex justify-center">
        <BillingToggle billingPeriod={billingPeriod} onChange={setBillingPeriod} />
      </div>

      {/* Combo cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {comboPlans.map((plan) => {
          const priceCents = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
          const comboPlanType = plan.code || (plan.highlight ? 'combo_completo' : 'combo_pro_select2k');
          const isCurrentCombo = isSubActiveForPlan(allSubs, comboPlanType);
          const userHighestLevel = Math.max(
            ...allSubs
              .filter(
                (s) =>
                  ['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status) ||
                  (s.status === 'CANCELLED' && s.next_due_date && new Date(s.next_due_date) > new Date())
              )
              .map((s) => getPlanHierarchyLevel(s.plan_type)),
            0
          );
          const cardLevel = getPlanHierarchyLevel(comboPlanType);
          const isInferiorToActive =
            !isCurrentCombo && userHighestLevel > cardLevel && userHighestLevel >= 100;

          // Cycle upgrade detection
          const activeComboSub = allSubs.find(
            (s) => s.plan_type === comboPlanType && ['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status)
          );
          const currentComboCycle = activeComboSub?.billing_cycle || 'MONTHLY';
          const viewingCycle = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
          const isCycleUpgrade =
            isCurrentCombo && currentComboCycle === 'MONTHLY' && viewingCycle === 'YEARLY';

          return (
            <div
              key={plan.name}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-card p-8 transition-all hover:shadow-md',
                isCurrentCombo && !isCycleUpgrade
                  ? 'border-primary/50 bg-primary/5 opacity-80'
                  : plan.highlight
                    ? 'border-primary shadow-md ring-1 ring-primary/20'
                    : 'border-border shadow-sm'
              )}
            >
              {isCurrentCombo && !isCycleUpgrade && (
                <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">
                  Plano atual
                </Badge>
              )}
              {isCycleUpgrade && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs gap-1">
                  <ArrowUp className="h-3 w-3" />
                  Mudar para anual
                </Badge>
              )}
              {!isCurrentCombo && plan.tag && (
                <Badge className="absolute -top-3 left-6 text-xs">{plan.tag}</Badge>
              )}
              <p className="text-lg font-semibold text-foreground">{plan.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {plan.credits.toLocaleString('pt-BR')} créditos mensais incluídos
              </p>
              <ul className="mt-6 space-y-2.5 flex-1">
                {plan.benefits.map((b: string) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 mt-0.5 text-primary/70 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <p className="text-2xl font-bold text-primary">
                  {formatPrice(priceCents)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                  </span>
                </p>
              </div>
              {billingPeriod === 'yearly' && (
                <p className="text-xs text-primary/80 mt-1">Economize 16% em relação ao mensal</p>
              )}
              {isCycleUpgrade ? (
                <Button
                  className="mt-6 px-8"
                  size="lg"
                  onClick={() => onSubscribe(comboPlanType, plan.name, priceCents)}
                >
                  <ArrowUp className="h-4 w-4 mr-1.5" />
                  Mudar para anual
                </Button>
              ) : isCurrentCombo ? (
                <Button
                  className="mt-6 px-8"
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/app/minha-conta?tab=planos')}
                >
                  Gerenciar assinatura
                </Button>
              ) : isInferiorToActive ? (
                <Button className="mt-6 px-8" size="lg" variant="outline" disabled>
                  <ArrowDown className="h-4 w-4 mr-1.5" />
                  Plano inferior ao atual
                </Button>
              ) : (
                <Button
                  className="mt-6 px-8"
                  size="lg"
                  onClick={() => onSubscribe(comboPlanType, plan.name, priceCents)}
                >
                  {plan.buttonLabel}
                </Button>
              )}
              {billingPeriod === 'yearly' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                  <Info className="h-3 w-3 shrink-0 text-primary" />
                  Renovação manual após 12 meses
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
