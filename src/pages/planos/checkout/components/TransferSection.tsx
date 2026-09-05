import { useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowDown, HardDrive, Star, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isSubActiveForPlan, getPlanHierarchyLevel, getPlanDisplayName } from '@/lib/transferPlans';
import { BillingToggle } from './BillingToggle';

interface TransferSectionProps {
  isUpgradeMode: boolean;
  currentPlanType: string;
  dynamicPlanName: (type: string) => string | undefined;
  daysRemaining: number;
  billingPeriod: 'monthly' | 'yearly';
  setBillingPeriod: (period: 'monthly' | 'yearly') => void;
  transferPlans: any[];
  allSubs: any[];
  activeSubs: any[];
  currentPriceCents: number;
  totalCycleDays: number;
  currentSubscriptionId?: string;
  getCrossProductProrata: (targetPlan: string, targetPrice: number) => any;
  formatPrice: (cents: number) => string;
  onSubscribe: (planType: string, planName: string, priceCents: number) => void;
  onOpenDowngrade: (planType: string, planName: string, billingCycle: string) => void;
  transferCombo: {
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
  };
}

export function TransferSection({
  isUpgradeMode,
  currentPlanType,
  dynamicPlanName,
  daysRemaining,
  billingPeriod,
  setBillingPeriod,
  transferPlans,
  allSubs,
  activeSubs,
  currentPriceCents,
  totalCycleDays,
  currentSubscriptionId,
  getCrossProductProrata,
  formatPrice,
  onSubscribe,
  onOpenDowngrade,
  transferCombo,
}: TransferSectionProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* Upgrade banner */}
      {isUpgradeMode && currentPlanType && (
        <section className="container max-w-6xl -mt-12 md:-mt-16 relative z-[2] pb-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-start gap-3">
            <ArrowUp className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Seu plano atual:{' '}
                <span className="text-primary">
                  {dynamicPlanName(currentPlanType) || getPlanDisplayName(currentPlanType)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Você pagará apenas a diferença proporcional ao período restante ({daysRemaining} dias
                restantes).
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Billing toggle */}
      <section
        className={cn(
          'container max-w-6xl relative z-[1] pb-8',
          !isUpgradeMode && '-mt-12 md:-mt-16'
        )}
      >
        <div className="flex justify-center">
          <BillingToggle billingPeriod={billingPeriod} onChange={setBillingPeriod} discount="-20%" />
        </div>
      </section>

      {/* Transfer plan cards */}
      <section className="container max-w-6xl pb-20 relative z-[1]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {transferPlans.map((plan) => {
            const effectiveBilling = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
            const price = effectiveBilling === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
            const monthlyEquiv =
              effectiveBilling === 'YEARLY'
                ? formatPrice(Math.round(plan.yearlyPrice / 12))
                : null;

            const planKey = plan.code || `transfer_${plan.storage.toLowerCase()}`;
            const isCurrentPlan = isUpgradeMode && planKey === currentPlanType;

            // Hierarchy-based downgrade
            const cardHierarchy = getPlanHierarchyLevel(planKey);
            const highestActiveLevel = Math.max(
              ...activeSubs.map((s) => getPlanHierarchyLevel(s.plan_type)),
              0
            );
            const isDowngrade = isUpgradeMode && !isCurrentPlan && highestActiveLevel > cardHierarchy;

            // Prorata calculation
            let prorataValue: number | null = null;
            let creditDisplay: number | null = null;
            if (isUpgradeMode && !isCurrentPlan && !isDowngrade) {
              const newPrice = effectiveBilling === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
              const transferCreditCents = Math.min(
                Math.round(currentPriceCents * (daysRemaining / totalCycleDays)),
                currentPriceCents
              );
              const crossProduct = getCrossProductProrata(planKey, newPrice);
              let combinedCredit = transferCreditCents;
              if (crossProduct) {
                const extraCredit =
                  crossProduct.creditCents -
                  (crossProduct.subscriptionIdsToCancel.includes(currentSubscriptionId)
                    ? transferCreditCents
                    : 0);
                combinedCredit += extraCredit;
              }
              creditDisplay = combinedCredit;
              prorataValue = Math.max(0, newPrice - combinedCredit);
            }

            return (
              <div
                key={plan.name}
                className={cn(
                  'relative flex flex-col rounded-2xl border bg-card p-8 transition-all hover:shadow-md',
                  isCurrentPlan
                    ? 'border-primary/50 bg-primary/5 opacity-80'
                    : isDowngrade
                      ? 'border-border shadow-sm'
                      : plan.highlight
                        ? 'border-primary shadow-md ring-1 ring-primary/20'
                        : 'border-border shadow-sm'
                )}
              >
                {isCurrentPlan && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs"
                  >
                    Plano atual
                  </Badge>
                )}
                {!isCurrentPlan && !isDowngrade && plan.tag && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs gap-1">
                    <Star className="h-3 w-3" />
                    {plan.tag}
                  </Badge>
                )}

                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-primary/70" />
                  <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Armazenamento mensal</p>

                <div className="mt-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-3xl font-bold text-primary">
                      {formatPrice(price)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{effectiveBilling === 'YEARLY' ? 'ano' : 'mês'}
                      </span>
                    </p>
                    {effectiveBilling === 'YEARLY' && (
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                        Até 12x sem juros
                      </Badge>
                    )}
                  </div>
                  {effectiveBilling === 'YEARLY' && (
                    <p className="text-xs text-muted-foreground mt-1">apenas {monthlyEquiv}/mês</p>
                  )}
                </div>

                {isUpgradeMode && creditDisplay !== null && creditDisplay > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Crédito de planos ativos: {formatPrice(creditDisplay)}
                  </p>
                )}

                {prorataValue !== null && (
                  <p className="text-sm font-medium text-primary mt-2">
                    Pagar agora: {formatPrice(prorataValue)}
                  </p>
                )}

                <div className="mt-auto pt-6">
                  {isCurrentPlan ? (
                    <Button className="w-full px-8" size="lg" disabled>
                      Plano atual
                    </Button>
                  ) : isDowngrade ? (
                    <Button
                      variant="outline"
                      className="w-full px-8 gap-1.5"
                      size="lg"
                      onClick={() =>
                        onOpenDowngrade(planKey, `Transfer ${plan.name}`, effectiveBilling)
                      }
                    >
                      <ArrowDown className="h-4 w-4" />
                      Agendar downgrade
                    </Button>
                  ) : (
                    <Button
                      className="w-full px-8"
                      size="lg"
                      onClick={() => onSubscribe(planKey, `Transfer ${plan.name}`, price)}
                    >
                      {isUpgradeMode ? 'Fazer upgrade' : 'Assinar'}
                    </Button>
                  )}
                </div>

                {billingPeriod === 'yearly' && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                    <Info className="h-3 w-3 shrink-0 text-primary" />
                    Renovação manual após 12 meses
                  </p>
                )}

                <ul className="mt-6 space-y-2.5 flex-1">
                  {plan.benefits?.map(({ icon: Icon, label }: any) => (
                    <li key={label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <Icon className="h-4 w-4 text-primary/70 shrink-0" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Transfer combo block */}
      <section className="container max-w-5xl pb-20 space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Integre com gestão e seleção
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Combine armazenamento com gestão completa e seleção profissional.
          </p>
        </div>

        {(() => {
          const isCurrentComboCompleto = isSubActiveForPlan(allSubs, 'combo_completo');
          const comboPrice =
            billingPeriod === 'monthly'
              ? transferCombo.monthlyPrice
              : transferCombo.yearlyPrice;

          const activeComboSub = allSubs.find(
            (s) => s.plan_type === 'combo_completo' && ['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status)
          );
          const currentComboCycle = activeComboSub?.billing_cycle || 'MONTHLY';
          const viewingCycle = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';
          const isCycleUpgrade =
            isCurrentComboCompleto &&
            currentComboCycle === 'MONTHLY' &&
            viewingCycle === 'YEARLY';

          return (
            <div
              className={cn(
                'rounded-2xl border p-8 transition-all hover:shadow-md',
                isCurrentComboCompleto && !isCycleUpgrade
                  ? 'border-primary/50 bg-primary/5 opacity-80'
                  : 'border-primary/50 bg-primary/5'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-2">
                  {isCurrentComboCompleto && !isCycleUpgrade && (
                    <Badge variant="secondary" className="text-xs mb-2">
                      Plano atual
                    </Badge>
                  )}
                  {isCycleUpgrade && (
                    <Badge className="text-xs mb-2 gap-1">
                      <ArrowUp className="h-3 w-3" />
                      Mudar para anual
                    </Badge>
                  )}
                  <p className="text-lg font-semibold text-foreground">{transferCombo.name}</p>
                  <p className="text-3xl font-bold text-primary">
                    {formatPrice(comboPrice)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                    </span>
                  </p>
                  {billingPeriod === 'yearly' && (
                    <>
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5 w-fit">
                        Até 12x sem juros
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        apenas {formatPrice(Math.round(transferCombo.yearlyPrice / 12))}/mês
                      </p>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {isCycleUpgrade ? (
                    <Button
                      size="lg"
                      className="px-8 shrink-0"
                      onClick={() =>
                        onSubscribe('combo_completo', transferCombo.name, comboPrice)
                      }
                    >
                      <ArrowUp className="h-4 w-4 mr-1.5" />
                      Mudar para anual
                    </Button>
                  ) : isCurrentComboCompleto ? (
                    <Button
                      size="lg"
                      className="px-8 shrink-0"
                      variant="outline"
                      onClick={() => navigate('/app/minha-conta?tab=planos')}
                    >
                      Gerenciar assinatura
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="px-8 shrink-0"
                      onClick={() =>
                        onSubscribe('combo_completo', transferCombo.name, comboPrice)
                      }
                    >
                      Conhecer plano completo
                    </Button>
                  )}
                  {billingPeriod === 'yearly' && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3 w-3 shrink-0 text-primary" />
                      Renovação manual após 12 meses
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </section>
    </>
  );
}
