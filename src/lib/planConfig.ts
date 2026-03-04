/** @deprecated Fallback only — use useUnifiedPlans() hook for dynamic prices from DB. */
export const ALL_PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  studio_starter: { monthly: 1490, yearly: 15198 },
  studio_pro: { monthly: 3590, yearly: 36618 },
  transfer_5gb: { monthly: 1290, yearly: 12384 },
  transfer_20gb: { monthly: 2490, yearly: 23904 },
  transfer_50gb: { monthly: 3490, yearly: 33504 },
  transfer_100gb: { monthly: 5990, yearly: 57504 },
  combo_pro_select2k: { monthly: 4490, yearly: 45259 },
  combo_completo: { monthly: 6490, yearly: 66198 },
};

/** Display names for each plan — fallback only, prefer DB name. */
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  studio_starter: 'Lunari Starter',
  studio_pro: 'Lunari Pro',
  transfer_5gb: 'Gallery Transfer 5GB',
  transfer_20gb: 'Gallery Transfer 20GB',
  transfer_50gb: 'Gallery Transfer 50GB',
  transfer_100gb: 'Gallery Transfer 100GB',
  combo_pro_select2k: 'Studio Pro + Select 2k',
  combo_completo: 'Combo Completo',
};

/** Product family for each plan_type. */
export const PLAN_FAMILIES: Record<string, string> = {
  studio_starter: 'studio',
  studio_pro: 'studio',
  transfer_5gb: 'transfer',
  transfer_20gb: 'transfer',
  transfer_50gb: 'transfer',
  transfer_100gb: 'transfer',
  combo_pro_select2k: 'combo',
  combo_completo: 'combo',
};

/** Which product capabilities each plan includes. */
export const PLAN_INCLUDES: Record<string, { studio: boolean; select: boolean; transfer: boolean }> = {
  studio_starter: { studio: true, select: false, transfer: false },
  studio_pro: { studio: true, select: false, transfer: false },
  transfer_5gb: { studio: false, select: false, transfer: true },
  transfer_20gb: { studio: false, select: false, transfer: true },
  transfer_50gb: { studio: false, select: false, transfer: true },
  transfer_100gb: { studio: false, select: false, transfer: true },
  combo_pro_select2k: { studio: true, select: true, transfer: false },
  combo_completo: { studio: true, select: true, transfer: true },
};

/** Ordered list for upgrade/downgrade validation (lowest → highest). */
export const PLAN_ORDER = [
  'studio_starter',
  'transfer_5gb',
  'transfer_20gb',
  'studio_pro',
  'transfer_50gb',
  'combo_pro_select2k',
  'transfer_100gb',
  'combo_completo',
];

/** Check if a plan is a Studio-family plan (studio or combo). */
export function isStudioFamilyPlan(planType: string | null | undefined): boolean {
  if (!planType) return false;
  const family = PLAN_FAMILIES[planType];
  return family === 'studio' || family === 'combo';
}

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
