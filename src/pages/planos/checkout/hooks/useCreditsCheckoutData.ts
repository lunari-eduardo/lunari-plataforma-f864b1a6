import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { useCreditPackages, CreditPackage } from '@/hooks/useCreditPackages';
import { useAsaasSubscription, AsaasSubscription } from '@/hooks/useAsaasSubscription';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { useUnifiedPlans } from '@/hooks/useUnifiedPlans';
import { PLAN_INCLUDES } from '@/lib/planConfig';
import {
  getStorageLimitBytes,
  formatStorageSize,
  getPlanHierarchyLevel,
  isSubActiveForPlan,
  getPlanDisplayName,
} from '@/lib/transferPlans';
import {
  FALLBACK_COMBO_PLANS,
  FALLBACK_TRANSFER_PLANS,
  COMPARISON_ROWS,
} from '../types';

export function useCreditsCheckoutData() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'transfer' ? 'transfer' : 'select';

  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(() => {
    const urlCycle = searchParams.get('billing_cycle');
    if (urlCycle === 'YEARLY') return 'yearly';
    return 'monthly';
  });

  const { packages, isLoadingPackages } = useCreditPackages();
  const {
    subscription: activeSub,
    subscriptions: allSubs,
    studioSub,
    downgradeSubscription,
    isDowngrading,
  } = useAsaasSubscription();

  const transferSub = allSubs.find((s) => PLAN_INCLUDES[s.plan_type]?.transfer);
  const { storageUsedBytes } = useTransferStorage();

  // Dynamic pricing from unified_plans
  const {
    plans: dynamicPlans,
    getPlanPrice,
    getPlanName: dynamicPlanName,
    getAllPlanPrices,
    isLoading: isLoadingPlans,
  } = useUnifiedPlans();
  const ALL_PLAN_PRICES_MAP = getAllPlanPrices();

  // Build transfer plans from dynamic data or fallback
  const dynamicTransfer = useMemo(
    () => dynamicPlans.filter((p) => p.includes_transfer && !p.includes_studio),
    [dynamicPlans]
  );
  const TRANSFER_PLANS =
    dynamicTransfer.length > 0
      ? dynamicTransfer.map((p) => ({
          code: p.code,
          name: p.name.replace('Transfer ', '').replace('transfer_', ''),
          monthlyPrice: p.monthly_price_cents,
          yearlyPrice: p.yearly_price_cents,
          storage: formatStorageSize(p.transfer_storage_bytes),
          highlight: p.code === 'transfer_20gb',
          tag: p.code === 'transfer_20gb' ? 'Mais escolhido' : undefined,
        }))
      : FALLBACK_TRANSFER_PLANS;

  // Build combo plans from dynamic data or fallback
  const dynamicCombos = useMemo(
    () => dynamicPlans.filter((p) => p.product_family === 'combo'),
    [dynamicPlans]
  );
  const COMBO_PLANS =
    dynamicCombos.length > 0
      ? dynamicCombos.map((p) => ({
          code: p.code,
          name: p.name,
          monthlyPrice: p.monthly_price_cents,
          yearlyPrice: p.yearly_price_cents,
          credits: p.select_credits_monthly,
          benefits:
            p.code === 'combo_completo'
              ? [
                  'Gestão completa',
                  `${p.select_credits_monthly.toLocaleString('pt-BR')} créditos mensais`,
                  `${formatStorageSize(p.transfer_storage_bytes)} de armazenamento profissional`,
                  'Entrega profissional no seu estilo',
                ]
              : [
                  'Sistema completo de gestão',
                  `${p.select_credits_monthly.toLocaleString('pt-BR')} créditos mensais`,
                  'Integração automática com Gallery',
                  'Controle de clientes',
                  'Fluxo de trabalho',
                  'Automações de pagamentos',
                ],
          buttonLabel: 'Assinar',
          highlight: p.code === 'combo_completo',
          tag: p.code === 'combo_completo' ? 'Mais completo' : undefined,
        }))
      : FALLBACK_COMBO_PLANS;

  // Transfer combo card
  const comboCompletoData = COMBO_PLANS.find((p) => p.code === 'combo_completo');
  const TRANSFER_COMBO = {
    name: comboCompletoData?.name || 'Studio Pro + Select 2k + Transfer 20GB',
    monthlyPrice: comboCompletoData?.monthlyPrice || 6490,
    yearlyPrice: comboCompletoData?.yearlyPrice || 66198,
  };

  // Comparison row prices (dynamic)
  const proMonthly = getPlanPrice('combo_pro_select2k', 'MONTHLY');
  const fullMonthly = getPlanPrice('combo_completo', 'MONTHLY');
  const comparisonRows = COMPARISON_ROWS.map((row) => {
    if (row.label === 'Preço') {
      return {
        ...row,
        pro: `R$ ${(proMonthly / 100).toFixed(2).replace('.', ',')}/mês`,
        full: `R$ ${(fullMonthly / 100).toFixed(2).replace('.', ',')}/mês`,
      };
    }
    return row;
  });

  // Upgrade mode: auto-detect from hook OR from URL params
  const urlUpgradeMode = searchParams.get('upgrade') === 'true';
  const urlCurrentPlan = searchParams.get('current_plan') || '';
  const urlBillingCycle = searchParams.get('billing_cycle') || 'MONTHLY';
  const urlNextDueDate = searchParams.get('next_due_date') || '';
  const urlSubscriptionId = searchParams.get('subscription_id') || '';

  const hasActiveTransferSub =
    !!transferSub &&
    (transferSub.status === 'ACTIVE' ||
      transferSub.status === 'PENDING' ||
      transferSub.status === 'OVERDUE') &&
    activeTab === 'transfer';
  const isUpgradeMode = urlUpgradeMode || hasActiveTransferSub;

  const activeSubs = allSubs.filter(
    (s) =>
      ['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status) ||
      (s.status === 'CANCELLED' && s.next_due_date && new Date(s.next_due_date) > new Date())
  );

  const currentPlanType =
    activeTab === 'transfer' ? transferSub?.plan_type || urlCurrentPlan : activeSub?.plan_type || urlCurrentPlan;
  const currentSub = activeTab === 'transfer' ? transferSub : activeSub;
  const currentBillingCycle = currentSub?.billing_cycle || urlBillingCycle;
  const nextDueDate = currentSub?.next_due_date || urlNextDueDate;
  const currentSubscriptionId = currentSub?.id || urlSubscriptionId;

  const currentPlanPrices = (ALL_PLAN_PRICES_MAP as any)[currentPlanType];
  const currentPriceCents = currentPlanPrices
    ? currentBillingCycle === 'YEARLY'
      ? currentPlanPrices.yearly
      : currentPlanPrices.monthly
    : 0;

  const stdCycleDays = currentBillingCycle === 'YEARLY' ? 365 : 30;
  const daysRemaining = nextDueDate
    ? Math.min(Math.max(0, differenceInDays(new Date(nextDueDate), new Date())), stdCycleDays)
    : 0;
  const totalCycleDays = stdCycleDays;

  function getOverlappingSubs(targetPlanType: string): AsaasSubscription[] {
    const targetIncludes = PLAN_INCLUDES[targetPlanType];
    if (!targetIncludes) return [];
    return activeSubs.filter((sub) => {
      if (sub.plan_type === targetPlanType) return false;
      const subIncludes = PLAN_INCLUDES[sub.plan_type];
      if (!subIncludes) return false;
      return (
        (targetIncludes.studio && subIncludes.studio) ||
        (targetIncludes.select && subIncludes.select) ||
        (targetIncludes.transfer && subIncludes.transfer)
      );
    });
  }

  function getCrossProductProrata(targetPlanType: string, targetPriceCents: number) {
    const overlapping = getOverlappingSubs(targetPlanType);
    if (overlapping.length === 0) return null;
    let totalCreditCents = 0;
    const idsToCancel: string[] = [];
    for (const sub of overlapping) {
      const subPrices = (ALL_PLAN_PRICES_MAP as any)[sub.plan_type];
      if (!subPrices) continue;
      const subPriceCents = sub.billing_cycle === 'YEARLY' ? subPrices.yearly : subPrices.monthly;
      const subDaysRemaining = sub.next_due_date
        ? Math.max(0, differenceInDays(new Date(sub.next_due_date), new Date()))
        : 0;
      const subCycleDays = sub.billing_cycle === 'YEARLY' ? 365 : 30;
      const cappedSubDays = Math.min(subDaysRemaining, subCycleDays);
      const rawCredit = Math.round(subPriceCents * (cappedSubDays / subCycleDays));
      totalCreditCents += Math.min(rawCredit, subPriceCents);
      idsToCancel.push(sub.id);
    }
    return {
      creditCents: totalCreditCents,
      prorataValueCents: Math.max(0, targetPriceCents - totalCreditCents),
      subscriptionIdsToCancel: idsToCancel,
    };
  }

  const avulsos = packages?.filter((p) => p.sort_order < 10) || [];

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleBuy = (pkg: CreditPackage) => {
    navigate('/app/planos-e-creditos/pay', {
      state: {
        type: 'select',
        packageId: pkg.id,
        packageName: pkg.name,
        credits: pkg.credits,
        priceCents: pkg.price_cents,
      },
    });
  };

  const handleSubscribe = (planType: string, planName: string, priceCents: number) => {
    const selectedCycle = billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY';

    const existingSubForPlan = allSubs.find(
      (s) => s.plan_type === planType && ['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status)
    );
    const isCycleUpgrade = !!existingSubForPlan && existingSubForPlan.billing_cycle !== selectedCycle;

    if (!isCycleUpgrade && isSubActiveForPlan(allSubs, planType)) {
      toast.error('Você já possui este plano ativo.');
      return;
    }

    if (isCycleUpgrade && existingSubForPlan) {
      const newCyclePriceCents = getPlanPrice(
        planType,
        selectedCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
      );
      const existingPriceCents = getPlanPrice(
        existingSubForPlan.plan_type,
        existingSubForPlan.billing_cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
      );
      const existingCycleDays = existingSubForPlan.billing_cycle === 'YEARLY' ? 365 : 30;
      const existingDaysRemaining = existingSubForPlan.next_due_date
        ? Math.min(
            Math.max(0, differenceInDays(new Date(existingSubForPlan.next_due_date), new Date())),
            existingCycleDays
          )
        : 0;
      const creditCents = Math.min(
        Math.round(existingPriceCents * (existingDaysRemaining / existingCycleDays)),
        existingPriceCents
      );
      const finalProrata = Math.max(0, newCyclePriceCents - creditCents);

      navigate('/app/planos-e-creditos/pay', {
        state: {
          type: 'subscription',
          planType,
          planName,
          billingCycle: selectedCycle as 'MONTHLY' | 'YEARLY',
          priceCents: newCyclePriceCents,
          isUpgrade: true,
          prorataValueCents: finalProrata,
          currentSubscriptionId: existingSubForPlan.id,
          subscriptionIdsToCancel: [existingSubForPlan.id],
          currentPlanName:
            dynamicPlanName(existingSubForPlan.plan_type) ||
            getPlanDisplayName(existingSubForPlan.plan_type) ||
            existingSubForPlan.plan_type,
        },
      });
      return;
    }

    const newPriceCentsForCycle = getPlanPrice(
      planType,
      selectedCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
    );

    if (isUpgradeMode && currentSubscriptionId) {
      const creditCents = Math.min(
        Math.round(currentPriceCents * (daysRemaining / totalCycleDays)),
        currentPriceCents
      );
      const crossProduct = getCrossProductProrata(planType, newPriceCentsForCycle);
      const allIdsToCancel = [currentSubscriptionId];
      let combinedCredit = creditCents;
      if (crossProduct) {
        const extraIds = crossProduct.subscriptionIdsToCancel.filter(
          (id) => id !== currentSubscriptionId
        );
        allIdsToCancel.push(...extraIds);
        combinedCredit +=
          crossProduct.creditCents -
          (crossProduct.subscriptionIdsToCancel.includes(currentSubscriptionId) ? creditCents : 0);
      }
      const finalProrata = Math.max(0, newPriceCentsForCycle - combinedCredit);

      const cancelNames = allIdsToCancel
        .map((id) => activeSubs.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => dynamicPlanName(s!.plan_type) || getPlanDisplayName(s!.plan_type))
        .join(' + ');

      navigate('/app/planos-e-creditos/pay', {
        state: {
          type: 'subscription',
          planType,
          planName,
          billingCycle: selectedCycle as 'MONTHLY' | 'YEARLY',
          priceCents: newPriceCentsForCycle,
          isUpgrade: true,
          prorataValueCents: finalProrata,
          currentSubscriptionId,
          subscriptionIdsToCancel: allIdsToCancel,
          currentPlanName:
            cancelNames ||
            dynamicPlanName(currentPlanType) ||
            getPlanDisplayName(currentPlanType) ||
            currentPlanType,
        },
      });
    } else {
      const crossProduct = getCrossProductProrata(planType, newPriceCentsForCycle);
      if (crossProduct && crossProduct.subscriptionIdsToCancel.length > 0) {
        const cancelNames = crossProduct.subscriptionIdsToCancel
          .map((id) => activeSubs.find((s) => s.id === id))
          .filter(Boolean)
          .map((s) => dynamicPlanName(s!.plan_type) || getPlanDisplayName(s!.plan_type))
          .join(' + ');

        navigate('/app/planos-e-creditos/pay', {
          state: {
            type: 'subscription',
            planType,
            planName,
            billingCycle: selectedCycle as 'MONTHLY' | 'YEARLY',
            priceCents: newPriceCentsForCycle,
            isUpgrade: true,
            prorataValueCents: crossProduct.prorataValueCents,
            subscriptionIdsToCancel: crossProduct.subscriptionIdsToCancel,
            currentPlanName: cancelNames,
          },
        });
      } else {
        navigate('/app/planos-e-creditos/pay', {
          state: {
            type: 'subscription',
            planType,
            planName,
            billingCycle: selectedCycle as 'MONTHLY' | 'YEARLY',
            priceCents: newPriceCentsForCycle,
          },
        });
      }
    }
  };

  // Downgrade state
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
      navigate('/app/minha-conta?tab=planos');
    } catch {
      // toast handled by hook
    }
  };

  const newDowngradeLimitBytes = downgradeDialog ? getStorageLimitBytes(downgradeDialog.planType) : 0;
  const isOverLimitOnDowngrade = downgradeDialog ? storageUsedBytes > newDowngradeLimitBytes : false;

  return {
    navigate,
    activeTab,
    billingPeriod,
    setBillingPeriod,
    packages,
    isLoadingPackages,
    avulsos,
    isLoadingPlans,
    TRANSFER_PLANS,
    COMBO_PLANS,
    TRANSFER_COMBO,
    comparisonRows,
    isUpgradeMode,
    currentPlanType,
    daysRemaining,
    allSubs,
    activeSubs,
    currentPriceCents,
    totalCycleDays,
    currentSubscriptionId,
    storageUsedBytes,
    downgradeDialog,
    setDowngradeDialog,
    downgradeConfirmed,
    setDowngradeConfirmed,
    isDowngrading,
    newDowngradeLimitBytes,
    isOverLimitOnDowngrade,
    formatPrice,
    handleBuy,
    handleSubscribe,
    handleDowngrade,
    dynamicPlanName,
    getCrossProductProrata,
  };
}
