/**
 * Componentes de destaque de promoção — usados na Home e em /precos.
 *
 * Fonte: `usePromotions()` (tabela `site_promotions`, RLS público quando ativa).
 */
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TOKENS, monoFont, uiFont } from "@/components/landing/primitives";
import type { SitePromotion } from "@/hooks/site/usePromotions";

/* ─────────────────────────────────────────────────────────────
   PromoStrip — barra fina no topo (embaixo do SiteNav)
   ───────────────────────────────────────────────────────────── */
export function PromoStrip({ promo }: { promo: SitePromotion }) {
  const nav = useNavigate();
  const dismissKey = `promo_dismissed_${promo.slug}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(dismissKey) === "1";
  });

  useEffect(() => {
    if (dismissed && typeof window !== "undefined") {
      sessionStorage.setItem(dismissKey, "1");
    }
  }, [dismissed, dismissKey]);

  if (dismissed) return null;

  const handleCta = () => {
    if (promo.cta_href) {
      if (/^https?:\/\//.test(promo.cta_href)) window.location.href = promo.cta_href;
      else nav(promo.cta_href);
    } else {
      nav("/auth");
    }
  };

  return (
    <div
      className="fixed left-0 right-0 top-[56px] z-40 border-b"
      style={{
        background: TOKENS.navy,
        borderColor: "rgba(255,255,255,0.08)",
        color: "#FAFAF7",
      }}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-2.5 md:px-8">
        <div className="flex flex-1 items-center gap-3 overflow-hidden">
          {promo.badge_label && (
            <span
              className="hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] md:inline-block"
              style={{
                ...monoFont,
                background: "#C9A87C",
                color: TOKENS.paper,
              }}
            >
              {promo.badge_label}
            </span>
          )}
          <span
            className="truncate text-[13px] leading-tight md:text-[14px]"
            style={uiFont}
          >
            <span className="font-medium">{promo.title}</span>
            {promo.subtitle && (
              <span className="ml-2 opacity-70">— {promo.subtitle}</span>
            )}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleCta}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors hover:opacity-80"
            style={{
              ...uiFont,
              background: "#C9A87C",
              color: TOKENS.paper,
            }}
          >
            {promo.cta_label} →
          </button>
          <button
            aria-label="Fechar"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PromoBadge — badge sobre o card do plano (canto superior direito)
   ───────────────────────────────────────────────────────────── */
export function PromoBadge({
  label,
  tone = "light",
}: {
  label: string;
  tone?: "light" | "dark";
}) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.16em]"
      style={{
        ...monoFont,
        background: "#C9A87C",
        color: "#FFFFFF",
        boxShadow:
          tone === "dark"
            ? "0 0 0 1px rgba(255,255,255,0.15)"
            : "0 0 0 1px rgba(10,10,10,0.06)",
      }}
    >
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   PromoPriceLabel — mostra preço original riscado + final destacado
   ───────────────────────────────────────────────────────────── */
export function PromoPriceLabel({
  originalCents,
  finalCents,
  tone = "light",
}: {
  originalCents: number;
  finalCents: number;
  tone?: "light" | "dark";
}) {
  if (originalCents === finalCents) return null;
  return (
    <div className="mt-2 flex items-center gap-2" style={uiFont}>
      <span
        className="text-[13px] line-through"
        style={{ color: tone === "dark" ? "rgba(255,255,255,0.5)" : "rgba(10,10,10,0.4)" }}
      >
        {(originalCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </span>
      <span
        className="text-[11px] font-medium uppercase tracking-[0.12em]"
        style={{ color: "#C9A87C" }}
      >
        promoção
      </span>
    </div>
  );
}
