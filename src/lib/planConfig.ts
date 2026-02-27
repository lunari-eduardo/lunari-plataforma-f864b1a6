/** Plan prices in cents for prorata calculation. */
export const ALL_PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  studio_starter: { monthly: 1490, yearly: 15198 },
  studio_pro: { monthly: 3590, yearly: 36618 },
  combo_pro_select2k: { monthly: 4490, yearly: 45259 },
  combo_completo: { monthly: 6490, yearly: 66198 },
};

/** Display names for each plan. */
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  studio_starter: 'Lunari Starter',
  studio_pro: 'Lunari Pro',
  combo_pro_select2k: 'Studio Pro + Select 2k',
  combo_completo: 'Combo Completo',
};

/** Product family for each plan_type. */
export const PLAN_FAMILIES: Record<string, string> = {
  studio_starter: 'studio',
  studio_pro: 'studio',
  combo_pro_select2k: 'combo',
  combo_completo: 'combo',
};

/** Which product capabilities each plan includes. */
export const PLAN_INCLUDES: Record<string, { studio: boolean; select: boolean; transfer: boolean }> = {
  studio_starter: { studio: true, select: false, transfer: false },
  studio_pro: { studio: true, select: false, transfer: false },
  combo_pro_select2k: { studio: true, select: true, transfer: false },
  combo_completo: { studio: true, select: true, transfer: true },
};

/** Ordered list for upgrade/downgrade validation (lowest → highest). */
export const PLAN_ORDER = [
  'studio_starter',
  'studio_pro',
  'combo_pro_select2k',
  'combo_completo',
];

export function getPlanDisplayName(planType: string | null | undefined): string {
  if (!planType) return 'Sem plano';
  return PLAN_DISPLAY_NAMES[planType] ?? planType;
}

export function isPlanUpgrade(currentPlan: string, newPlan: string): boolean {
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  const newIndex = PLAN_ORDER.indexOf(newPlan);
  if (currentIndex === -1 || newIndex === -1) return false;
  return newIndex > currentIndex;
}

export function isPlanDowngrade(currentPlan: string, newPlan: string): boolean {
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  const newIndex = PLAN_ORDER.indexOf(newPlan);
  if (currentIndex === -1 || newIndex === -1) return false;
  return newIndex < currentIndex;
}

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
