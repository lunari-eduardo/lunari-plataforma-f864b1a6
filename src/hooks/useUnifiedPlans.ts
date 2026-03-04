import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnifiedPlan {
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

export function useUnifiedPlans() {
  const query = useQuery({
    queryKey: ["unified-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;
      return (data as unknown as UnifiedPlan[]) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const plans = query.data || [];

  /** Get price in cents for a plan code + cycle */
  function getPlanPrice(code: string, cycle: "MONTHLY" | "YEARLY"): number {
    const plan = plans.find((p) => p.code === code);
    if (!plan) return 0;
    return cycle === "YEARLY" ? plan.yearly_price_cents : plan.monthly_price_cents;
  }

  /** Get prices object { monthly, yearly } compatible with old ALL_PLAN_PRICES shape */
  function getPlanPrices(code: string): { monthly: number; yearly: number } | null {
    const plan = plans.find((p) => p.code === code);
    if (!plan) return null;
    return { monthly: plan.monthly_price_cents, yearly: plan.yearly_price_cents };
  }

  /** Build a map equivalent to old ALL_PLAN_PRICES */
  function getAllPlanPrices(): Record<string, { monthly: number; yearly: number }> {
    const map: Record<string, { monthly: number; yearly: number }> = {};
    for (const p of plans) {
      map[p.code] = { monthly: p.monthly_price_cents, yearly: p.yearly_price_cents };
    }
    return map;
  }

  /** Get plan display name from DB */
  function getPlanName(code: string): string {
    const plan = plans.find((p) => p.code === code);
    return plan?.name || code;
  }

  return {
    plans,
    isLoading: query.isLoading,
    error: query.error,
    getPlanPrice,
    getPlanPrices,
    getAllPlanPrices,
    getPlanName,
  };
}
