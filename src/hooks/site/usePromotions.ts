/**
 * Hook público — promoções ativas do site institucional (`site_promotions`).
 *
 * A tabela é RLS-gated: apenas promoções `is_active=true` dentro da janela
 * de datas retornam pra `anon`/`authenticated` não-admin.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SitePromotion {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  badge_label: string | null;
  target_plan_code: string | null;
  target_credit_package_id: string | null;
  discount_type: "percent" | "absolute" | "override";
  discount_value_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  show_on_home: boolean;
  show_on_pricing: boolean;
  cta_label: string;
  cta_href: string | null;
  sort_order: number;
}

export function usePromotions() {
  const query = useQuery({
    queryKey: ["site-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_promotions" as any)
        .select("*")
        .order("sort_order");
      if (error) {
        // Se a tabela ainda não existe (migration não rodou), retorna vazio silenciosamente
        console.warn("[usePromotions] fetch error:", error.message);
        return [] as SitePromotion[];
      }
      return (data as unknown as SitePromotion[]) || [];
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const active = query.data || [];
  const home = active.filter((p) => p.show_on_home);
  const pricing = active.filter((p) => p.show_on_pricing);

  const byPlanCode = (code: string) =>
    active.find((p) => p.target_plan_code === code) || null;

  const byPackageId = (pkgId: string) =>
    active.find((p) => p.target_credit_package_id === pkgId) || null;

  return {
    isLoading: query.isLoading,
    active,
    home,
    pricing,
    byPlanCode,
    byPackageId,
  };
}

/** Aplica uma promoção a um valor em cents. */
export function applyPromoToCents(
  baseCents: number,
  promo: SitePromotion | null | undefined,
): { originalCents: number; finalCents: number; label: string } {
  if (!promo || baseCents <= 0) {
    return { originalCents: baseCents, finalCents: baseCents, label: "" };
  }
  let finalCents = baseCents;
  let label = "";
  switch (promo.discount_type) {
    case "percent": {
      const pct = Math.max(0, Math.min(100, promo.discount_value_cents));
      finalCents = Math.round(baseCents * (1 - pct / 100));
      label = `-${pct}%`;
      break;
    }
    case "absolute": {
      finalCents = Math.max(0, baseCents - promo.discount_value_cents);
      const rDiff = (promo.discount_value_cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      label = `-${rDiff}`;
      break;
    }
    case "override": {
      finalCents = Math.max(0, promo.discount_value_cents);
      label = "Oferta";
      break;
    }
  }
  return { originalCents: baseCents, finalCents, label };
}
