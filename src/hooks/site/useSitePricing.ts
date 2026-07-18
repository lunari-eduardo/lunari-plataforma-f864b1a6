/**
 * Hook público — preços dinâmicos do site institucional.
 *
 * Fonte de verdade: tabelas `unified_plans` + `gallery_credit_packages`.
 * Valores nunca ficam hard-coded no bundle do site — o admin edita e
 * o público reflete via este hook.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ALL_PLAN_PRICES } from "@/lib/planConfig";

export interface SiteUnifiedPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  product_family: "studio" | "transfer" | "combo" | string;
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

export interface SiteCreditPackage {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  active: boolean;
  sort_order: number;
  description: string | null;
}

export function useSitePricing() {
  const plansQuery = useQuery({
    queryKey: ["site-pricing", "unified_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data as unknown as SiteUnifiedPlan[]) || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const packagesQuery = useQuery({
    queryKey: ["site-pricing", "credit_packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_credit_packages")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data as unknown as SiteCreditPackage[]) || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const plans = plansQuery.data || [];
  const packages = packagesQuery.data || [];

  const byCode = (code: string) => plans.find((p) => p.code === code) || null;

  // Fallback pra quando o DB ainda não respondeu — usa planConfig
  const centsFromFallback = (code: string) =>
    ALL_PLAN_PRICES[code] || { monthly: 0, yearly: 0 };

  const priceCents = (code: string, cycle: "monthly" | "annual") => {
    const plan = byCode(code);
    if (plan) {
      return cycle === "monthly" ? plan.monthly_price_cents : plan.yearly_price_cents;
    }
    const f = centsFromFallback(code);
    return cycle === "monthly" ? f.monthly : f.yearly;
  };

  // "Pacotes de uso" do Select — filtra pacotes puros (excluí combos com bundle)
  const selectPackages = packages.filter((p) => !/\+/.test(p.name));

  // Menor preço de pacote ativo — usado como "a partir de R$ X" no card do Select
  const selectFromCents =
    selectPackages.length > 0
      ? Math.min(...selectPackages.map((p) => p.price_cents))
      : null;

  // Grupos por família
  const studioPlans = plans.filter((p) => p.product_family === "studio").sort((a, b) => a.sort_order - b.sort_order);
  const transferPlans = plans.filter((p) => p.product_family === "transfer").sort((a, b) => a.sort_order - b.sort_order);
  const comboPlans = plans.filter((p) => p.product_family === "combo").sort((a, b) => a.sort_order - b.sort_order);

  return {
    isLoading: plansQuery.isLoading || packagesQuery.isLoading,
    error: plansQuery.error || packagesQuery.error,
    plans,
    packages,
    selectPackages,
    selectFromCents,
    studioPlans,
    transferPlans,
    comboPlans,
    byCode,
    priceCents,
  };
}

/** Formata cents em BRL. */
export function fmtBRL(cents: number, opts?: { withCents?: boolean }) {
  const reais = cents / 100;
  return reais.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: opts?.withCents === false ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
