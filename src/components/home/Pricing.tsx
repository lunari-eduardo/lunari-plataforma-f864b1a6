import { useMemo } from "react";
import { Check } from "lucide-react";
import { SiteH2, SiteEyebrow, SiteLead, SiteReveal } from "../site/typography";
import { PrimaryButton } from "../site/primitives";
import { useSitePricing, fmtBRL, SiteUnifiedPlan } from "@/hooks/site/useSitePricing";
import { PLAN_COPY } from "@/content/site/pricing";
import { cn } from "@/lib/utils";

export function Pricing() {
  const { studioPlans, isLoading } = useSitePricing();

  // Filtra e ordena baseado no STUDIO_ORDER mas com fallback seguro
  const orderedStudio = useMemo(() => {
    const order = ["studio_starter", "studio_pro"];
    const found = order.map(code => studioPlans.find(p => p.code === code)).filter(Boolean) as SiteUnifiedPlan[];
    // Se não encontrou pela ordem, pega o que tiver da família studio
    return found.length > 0 ? found : studioPlans.slice(0, 2);
  }, [studioPlans]);

  return (
    <section id="pricing" data-tone="light" className="bg-site-warmwhite py-20 md:py-32 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <SiteReveal>
            <SiteEyebrow>Assinatura</SiteEyebrow>
            <SiteH2 tone="light">Um preço que cabe no seu crescimento.</SiteH2>
            <SiteLead tone="light" className="mt-6">
              Comece pelo Studio Starter e evolua conforme seu fluxo cresce. 
              Sem taxas ocultas, sem cobrança por foto.
            </SiteLead>
          </SiteReveal>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {isLoading ? (
            <div className="col-span-2 py-20 text-center text-site-ink/30 animate-pulse">
              Carregando planos...
            </div>
          ) : (
            orderedStudio.map((plan, i) => {
              const copy = PLAN_COPY[plan.code];
              const isPro = plan.code === "studio_pro";
              
              return (
                <SiteReveal key={plan.id} delay={i * 100}>
                  <div className={cn(
                    "relative flex flex-col h-full rounded-[32px] p-8 md:p-12 transition-all duration-500",
                    isPro 
                      ? "bg-site-graphite text-site-on-dark shadow-2xl scale-105 z-10" 
                      : "bg-white border border-site-line-light text-site-ink"
                  )}>
                    {isPro && (
                      <div className="absolute top-6 right-8">
                        <span className="bg-site-gold text-site-graphite text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                          Recomendado
                        </span>
                      </div>
                    )}

                    <div className="mb-8">
                      <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                      <p className={cn("text-sm", isPro ? "text-site-on-dark/50" : "text-site-ink/50")}>
                        {copy?.tagline || plan.description}
                      </p>
                    </div>

                    <div className="mb-10 flex items-baseline gap-2">
                      <span className="text-5xl font-bold tracking-tight">
                        {fmtBRL(plan.monthly_price_cents)}
                      </span>
                      <span className={cn("text-xs font-medium uppercase tracking-widest", isPro ? "text-site-on-dark/30" : "text-site-ink/30")}>
                        / mês
                      </span>
                    </div>

                    <ul className="flex-1 space-y-4 mb-12">
                      {(copy?.features || []).map((feature: string) => (
                        <li key={feature} className="flex items-start gap-3 text-sm leading-snug">
                          <Check className={cn("h-4 w-4 mt-0.5 shrink-0", isPro ? "text-site-gold" : "text-site-gold")} strokeWidth={3} />
                          <span className={isPro ? "text-site-on-dark/80" : "text-site-ink/80"}>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <PrimaryButton 
                      to={`/auth?plan=${plan.code}`} 
                      tone={isPro ? "dark" : "light"}
                      className="w-full"
                    >
                      Começar 30 dias grátis
                    </PrimaryButton>
                  </div>
                </SiteReveal>
              );
            })
          )}
        </div>

        <SiteReveal delay={300} className="mt-20 text-center">
          <p className="text-sm text-site-ink/40">
            Precisa de mais armazenamento ou galerias ilimitadas? 
            <a href="/precos" className="ml-2 text-site-gold font-bold hover:underline">Ver planos Studio Pro Max e Combos</a>
          </p>
        </SiteReveal>
      </div>
    </section>
  );
}
