import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAsaasSubscription, AsaasSubscription } from "@/hooks/useAsaasSubscription";
import { useAccessControl } from "@/hooks/useAccessControl";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Check, Star, ArrowUp, ArrowDown, AlertTriangle, Loader2, Info, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_PLAN_PRICES, getPlanDisplayName, isPlanUpgrade, isPlanDowngrade, formatPrice, PLAN_ORDER,
  isStudioFamilyPlan, PLAN_FAMILIES, PLAN_INCLUDES,
} from "@/lib/planConfig";
import { differenceInDays } from "date-fns";

/* ═══ STATIC DATA ═══ */

const STUDIO_PLANS = [
  {
    code: "studio_starter",
    name: "Starter",
    description: "Ideal para começar",
    features: [
      "Agenda completa",
      "CRM de clientes",
      "Workflow de produção",
      "Tutoriais",
      "Suporte por WhatsApp",
    ],
    popular: false,
  },
  {
    code: "studio_pro",
    name: "Pro",
    description: "Funcionalidades completas",
    features: [
      "Tudo do Starter",
      "Gestão de Leads",
      "Gestão de tarefas",
      "Financeiro completo",
      "Precificação e metas",
      "Análise de vendas detalhada",
      "Feed Preview",
      "Exportação de relatórios",
    ],
    popular: true,
  },
];

const COMBO_PLANS = [
  {
    code: "combo_pro_select2k",
    name: "Studio Pro + Select 2k",
    credits: 2000,
    benefits: [
      "Sistema completo de gestão",
      "2.000 créditos mensais",
      "Integração automática com Gallery",
      "Controle de clientes",
      "Fluxo de trabalho",
    ],
    highlight: false,
  },
  {
    code: "combo_completo",
    name: "Combo Completo",
    credits: 2000,
    benefits: [
      "Gestão completa",
      "2.000 créditos mensais",
      "20GB de armazenamento profissional",
      "Entrega profissional no seu estilo",
    ],
    highlight: true,
    tag: "Mais completo",
  },
];

/* ═══ COMPONENT ═══ */

export default function EscolherPlano() {
  const navigate = useNavigate();
  const { accessState } = useAccessControl();
  const { subscription: activeSub, subscriptions: allSubscriptions, downgradeSubscription, isDowngrading } = useAsaasSubscription();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  // Current plan detection — only consider Studio/Combo plans for upgrade mode
  const studioSub = activeSub && isStudioFamilyPlan(activeSub.plan_type) ? activeSub : null;
  const currentPlanType = studioSub?.plan_type || "";
  const currentBillingCycle = studioSub?.billing_cycle || "MONTHLY";
  const nextDueDate = studioSub?.next_due_date || "";
  const currentSubscriptionId = studioSub?.id || "";
  const isUpgradeMode = !!studioSub && studioSub.status === "ACTIVE";

  // Non-studio subscriptions (Gallery Transfer etc.) — show as subtle info
  const galleryOnlySub = activeSub && !isStudioFamilyPlan(activeSub.plan_type) ? activeSub : null;

  // All active subs for cross-product overlap detection
  const activeSubs = allSubscriptions.filter(s => s.status === "ACTIVE" || s.status === "PENDING");

  const currentPlanPrices = ALL_PLAN_PRICES[currentPlanType];
  const currentPriceCents = currentPlanPrices
    ? (currentBillingCycle === "YEARLY" ? currentPlanPrices.yearly : currentPlanPrices.monthly)
    : 0;

  const daysRemaining = nextDueDate ? Math.max(0, differenceInDays(new Date(nextDueDate), new Date())) : 0;
  const totalCycleDays = currentBillingCycle === "YEARLY" ? 365 : 30;

  /** Find active subs whose capabilities overlap with the target plan */
  function getOverlappingSubs(targetPlanType: string): AsaasSubscription[] {
    const targetIncludes = PLAN_INCLUDES[targetPlanType];
    if (!targetIncludes) return [];
    return activeSubs.filter(sub => {
      if (sub.plan_type === targetPlanType) return false; // same plan
      const subIncludes = PLAN_INCLUDES[sub.plan_type];
      if (!subIncludes) return false;
      // overlap if target includes any capability the sub already provides
      return (targetIncludes.studio && subIncludes.studio) ||
             (targetIncludes.select && subIncludes.select) ||
             (targetIncludes.transfer && subIncludes.transfer);
    });
  }

  /** Calculate combined prorata credit from overlapping subs */
  function getCrossProductProrata(targetPlanType: string, targetPriceCents: number) {
    const overlapping = getOverlappingSubs(targetPlanType);
    if (overlapping.length === 0) return null;
    let totalCreditCents = 0;
    const idsToCancel: string[] = [];
    for (const sub of overlapping) {
      const subPrices = ALL_PLAN_PRICES[sub.plan_type];
      if (!subPrices) continue;
      const subPriceCents = sub.billing_cycle === "YEARLY" ? subPrices.yearly : subPrices.monthly;
      const subDaysRemaining = sub.next_due_date
        ? Math.max(0, differenceInDays(new Date(sub.next_due_date), new Date()))
        : 0;
      const subTotalDays = sub.billing_cycle === "YEARLY" ? 365 : 30;
      totalCreditCents += Math.round(subPriceCents * (subDaysRemaining / subTotalDays));
      idsToCancel.push(sub.id);
    }
    return {
      creditCents: totalCreditCents,
      prorataValueCents: Math.max(0, targetPriceCents - totalCreditCents),
      subscriptionIdsToCancel: idsToCancel,
    };
  }

  // Downgrade dialog
  const [downgradeDialog, setDowngradeDialog] = useState<{
    planType: string;
    planName: string;
    billingCycle: string;
  } | null>(null);
  const [downgradeConfirmed, setDowngradeConfirmed] = useState(false);

  const handleDowngrade = async () => {
    if (!downgradeDialog || !currentSubscriptionId) return;
    try {
      await downgradeSubscription({
        subscriptionId: currentSubscriptionId,
        newPlanType: downgradeDialog.planType,
        newBillingCycle: downgradeDialog.billingCycle,
      });
      setDowngradeDialog(null);
      setDowngradeConfirmed(false);
      navigate("/minha-assinatura");
    } catch { /* handled by hook */ }
  };

  const handleSelectPlan = (planType: string, planName: string, priceCents: number) => {
    const selectedCycle = billingPeriod === "monthly" ? "MONTHLY" : "YEARLY";

    if (isUpgradeMode && currentSubscriptionId && isPlanUpgrade(currentPlanType, planType)) {
      // Same-family upgrade (studio → studio, combo → combo)
      const newPlanPrices = ALL_PLAN_PRICES[planType];
      const newPriceCents = selectedCycle === "YEARLY"
        ? (newPlanPrices?.yearly || priceCents)
        : (newPlanPrices?.monthly || priceCents);
      const creditCents = Math.round(currentPriceCents * (daysRemaining / totalCycleDays));
      const prorataValueCents = Math.max(0, newPriceCents - creditCents);

      // Also check for additional cross-product overlaps (e.g., user has studio + transfer, upgrading to combo)
      const crossProduct = getCrossProductProrata(planType, newPriceCents);
      const allIdsToCancel = [currentSubscriptionId];
      let combinedCredit = creditCents;
      if (crossProduct) {
        // Add credits from other overlapping subs (excluding the studio sub already counted)
        const extraIds = crossProduct.subscriptionIdsToCancel.filter(id => id !== currentSubscriptionId);
        allIdsToCancel.push(...extraIds);
        combinedCredit += crossProduct.creditCents - (crossProduct.subscriptionIdsToCancel.includes(currentSubscriptionId) ? creditCents : 0);
      }
      const finalProrata = Math.max(0, newPriceCents - combinedCredit);

      navigate("/escolher-plano/pagamento", {
        state: {
          type: "subscription",
          planType,
          planName,
          billingCycle: selectedCycle,
          priceCents: newPriceCents,
          isUpgrade: true,
          prorataValueCents: finalProrata,
          currentSubscriptionId,
          subscriptionIdsToCancel: allIdsToCancel,
          currentPlanName: getPlanDisplayName(currentPlanType),
        },
      });
    } else {
      // Check for cross-product upgrade (e.g., user has transfer_5gb, selecting combo)
      const crossProduct = getCrossProductProrata(planType, priceCents);
      if (crossProduct && crossProduct.subscriptionIdsToCancel.length > 0) {
        const currentSubNames = crossProduct.subscriptionIdsToCancel
          .map(id => activeSubs.find(s => s.id === id))
          .filter(Boolean)
          .map(s => getPlanDisplayName(s!.plan_type))
          .join(", ");

        navigate("/escolher-plano/pagamento", {
          state: {
            type: "subscription",
            planType,
            planName,
            billingCycle: selectedCycle,
            priceCents,
            isUpgrade: true,
            prorataValueCents: crossProduct.prorataValueCents,
            subscriptionIdsToCancel: crossProduct.subscriptionIdsToCancel,
            currentSubscriptionId: crossProduct.subscriptionIdsToCancel[0],
            currentPlanName: currentSubNames,
          },
        });
      } else {
        navigate("/escolher-plano/pagamento", {
          state: {
            type: "subscription",
            planType,
            planName,
            billingCycle: selectedCycle,
            priceCents,
          },
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Back */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/minha-assinatura")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent" />
        <div className="relative container max-w-6xl pt-10 pb-24 md:pb-28 text-center space-y-4">
          {galleryOnlySub && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
                    <Package className="h-3 w-3" />
                    {getPlanDisplayName(galleryOnlySub.plan_type)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Plano ativo no Lunari Gallery</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground max-w-2xl mx-auto text-balance">
            Escolha o plano ideal para seu estúdio
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            {accessState.isTrial && accessState.daysRemaining !== undefined
              ? accessState.daysRemaining > 0
                ? `Seu teste grátis termina em ${accessState.daysRemaining} dias`
                : "Seu teste grátis expirou"
              : "Sem compromisso • Cancele quando quiser"}
          </p>
        </div>
      </section>

      {/* Upgrade banner */}
      {isUpgradeMode && currentPlanType && (
        <section className="container max-w-6xl -mt-12 md:-mt-16 relative z-[2] pb-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-start gap-3">
            <ArrowUp className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Seu plano atual: <span className="text-primary">{getPlanDisplayName(currentPlanType)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Você pagará apenas a diferença proporcional ao período restante ({daysRemaining} dias restantes).
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Billing toggle */}
      <section className={cn("container max-w-6xl relative z-[1] pb-8", !isUpgradeMode && "-mt-12 md:-mt-16")}>
        <div className="flex justify-center">
          <BillingToggle billingPeriod={billingPeriod} onChange={setBillingPeriod} />
        </div>
      </section>

      {/* Studio Plan Cards */}
      <section className="container max-w-5xl pb-16 relative z-[1]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {STUDIO_PLANS.map((plan) => {
            const prices = ALL_PLAN_PRICES[plan.code];
            const effectiveCycle = billingPeriod === "monthly" ? "MONTHLY" : "YEARLY";
            const price = effectiveCycle === "YEARLY" ? prices.yearly : prices.monthly;
            const isCurrentPlan = isUpgradeMode && plan.code === currentPlanType;
            const isDowngrade = isUpgradeMode && isPlanDowngrade(currentPlanType, plan.code);
            const isUpgrade = isUpgradeMode && isPlanUpgrade(currentPlanType, plan.code);

            let prorataValue: number | null = null;
            if (isUpgrade) {
              const creditCents = Math.round(currentPriceCents * (daysRemaining / totalCycleDays));
              prorataValue = Math.max(0, price - creditCents);
            } else if (!isCurrentPlan) {
              // Cross-product prorata (e.g., user has transfer, selecting studio that overlaps via combo)
              const crossProduct = getCrossProductProrata(plan.code, price);
              if (crossProduct && crossProduct.subscriptionIdsToCancel.length > 0) {
                prorataValue = crossProduct.prorataValueCents;
              }
            }

            return (
              <div
                key={plan.code}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-8 transition-all hover:shadow-md",
                  isCurrentPlan
                    ? "border-primary/50 bg-primary/5 opacity-80"
                    : plan.popular
                      ? "border-primary shadow-md ring-1 ring-primary/20"
                      : "border-border shadow-sm"
                )}
              >
                {isCurrentPlan && (
                  <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">
                    Plano atual
                  </Badge>
                )}
                {!isCurrentPlan && plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs gap-1">
                    <Star className="h-3 w-3" />
                    Mais Popular
                  </Badge>
                )}

                <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>

                <p className="text-3xl font-bold text-primary mt-5">
                  {formatPrice(price)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{effectiveCycle === "YEARLY" ? "ano" : "mês"}
                  </span>
                </p>

                {billingPeriod === "yearly" && (
                  <p className="text-xs text-primary/80 mt-1">
                    Equivale a {formatPrice(Math.round(prices.yearly / 12))}/mês (~15% off)
                  </p>
                )}

                {prorataValue !== null && (
                  <p className="text-sm font-medium text-primary mt-2">
                    Pagar agora: {formatPrice(prorataValue)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">(proporcional)</span>
                  </p>
                )}

                <ul className="mt-6 space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 mt-0.5 text-primary/70 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <Button className="mt-6" size="lg" disabled>Plano atual</Button>
                ) : isDowngrade ? (
                  <Button
                    variant="outline"
                    className="mt-6 gap-1.5"
                    size="lg"
                    onClick={() => {
                      setDowngradeConfirmed(false);
                      setDowngradeDialog({ planType: plan.code, planName: plan.name, billingCycle: effectiveCycle });
                    }}
                  >
                    <ArrowDown className="h-4 w-4" />
                    Agendar downgrade
                  </Button>
                ) : (
                  <Button className="mt-6" size="lg" onClick={() => handleSelectPlan(plan.code, plan.name, price)}>
                    {isUpgrade ? "Fazer upgrade" : "Selecionar"}
                  </Button>
                )}

                {billingPeriod === "yearly" && (
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

      {/* Combos */}
      <section className="container max-w-5xl pb-20 space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Cresça com uma estrutura completa
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Combine gestão, seleção e armazenamento em um único sistema profissional.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {COMBO_PLANS.map((plan) => {
            const prices = ALL_PLAN_PRICES[plan.code];
            const effectiveCycle = billingPeriod === "monthly" ? "MONTHLY" : "YEARLY";
            const price = effectiveCycle === "YEARLY" ? prices.yearly : prices.monthly;
            const isCurrentPlan = isUpgradeMode && plan.code === currentPlanType;
            const isDowngrade = isUpgradeMode && isPlanDowngrade(currentPlanType, plan.code);
            const isUpgradeFlag = isUpgradeMode && isPlanUpgrade(currentPlanType, plan.code);

            let prorataValue: number | null = null;
            if (isUpgradeFlag) {
              const creditCents = Math.round(currentPriceCents * (daysRemaining / totalCycleDays));
              prorataValue = Math.max(0, price - creditCents);
            } else if (!isCurrentPlan) {
              const crossProduct = getCrossProductProrata(plan.code, price);
              if (crossProduct && crossProduct.subscriptionIdsToCancel.length > 0) {
                prorataValue = crossProduct.prorataValueCents;
              }
            }

            return (
              <div
                key={plan.code}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-8 transition-all hover:shadow-md",
                  isCurrentPlan
                    ? "border-primary/50 bg-primary/5 opacity-80"
                    : plan.highlight
                      ? "border-primary shadow-md ring-1 ring-primary/20"
                      : "border-border shadow-sm"
                )}
              >
                {isCurrentPlan && (
                  <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">
                    Plano atual
                  </Badge>
                )}
                {!isCurrentPlan && plan.tag && (
                  <Badge className="absolute -top-3 left-6 text-xs">{plan.tag}</Badge>
                )}

                <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {plan.credits.toLocaleString("pt-BR")} créditos mensais incluídos
                </p>

                <ul className="mt-6 space-y-2.5 flex-1">
                  {plan.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 mt-0.5 text-primary/70 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>

                <p className="text-2xl font-bold text-primary mt-6">
                  {formatPrice(price)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{billingPeriod === "monthly" ? "mês" : "ano"}
                  </span>
                </p>
                {billingPeriod === "yearly" && (
                  <p className="text-xs text-primary/80 mt-1">
                    Equivale a {formatPrice(Math.round(prices.yearly / 12))}/mês
                  </p>
                )}

                {prorataValue !== null && (
                  <p className="text-sm font-medium text-primary mt-2">
                    Pagar agora: {formatPrice(prorataValue)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">(proporcional)</span>
                  </p>
                )}

                {isCurrentPlan ? (
                  <Button className="mt-6" size="lg" disabled>Plano atual</Button>
                ) : isDowngrade ? (
                  <Button
                    variant="outline"
                    className="mt-6 gap-1.5"
                    size="lg"
                    onClick={() => {
                      setDowngradeConfirmed(false);
                      setDowngradeDialog({ planType: plan.code, planName: plan.name, billingCycle: effectiveCycle });
                    }}
                  >
                    <ArrowDown className="h-4 w-4" />
                    Agendar downgrade
                  </Button>
                ) : (
                  <Button className="mt-6" size="lg" onClick={() => handleSelectPlan(plan.code, plan.name, price)}>
                    {isUpgradeFlag ? "Fazer upgrade" : "Assinar"}
                  </Button>
                )}

                {billingPeriod === "yearly" && (
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

      {/* Downgrade Dialog */}
      <Dialog open={!!downgradeDialog} onOpenChange={(open) => {
        if (!open) { setDowngradeDialog(null); setDowngradeConfirmed(false); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Agendar downgrade
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                Seu plano será alterado para{" "}
                <span className="font-semibold text-foreground">
                  {downgradeDialog ? getPlanDisplayName(downgradeDialog.planType) : ""}
                </span>{" "}
                no próximo ciclo de cobrança. Você manterá o acesso ao plano atual até o vencimento.
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3 py-2">
            <Checkbox
              id="downgrade-confirm"
              checked={downgradeConfirmed}
              onCheckedChange={(checked) => setDowngradeConfirmed(checked === true)}
            />
            <label
              htmlFor="downgrade-confirm"
              className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
            >
              Entendo que o downgrade será aplicado apenas no próximo ciclo.
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDowngradeDialog(null); setDowngradeConfirmed(false); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isDowngrading || !downgradeConfirmed}
              onClick={handleDowngrade}
            >
              {isDowngrading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Agendando...</>
              ) : (
                "Confirmar downgrade"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══ SUB-COMPONENTS ═══ */

function BillingToggle({
  billingPeriod,
  onChange,
}: {
  billingPeriod: "monthly" | "yearly";
  onChange: (v: "monthly" | "yearly") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border bg-muted/50 p-1 gap-0.5">
      <button
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-5 py-2 text-sm font-medium transition-all",
          billingPeriod === "monthly"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Mensal
      </button>
      <button
        onClick={() => onChange("yearly")}
        className={cn(
          "rounded-full px-5 py-2 text-sm font-medium transition-all flex items-center gap-2",
          billingPeriod === "yearly"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Anual
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          -15%
        </Badge>
      </button>
    </div>
  );
}
