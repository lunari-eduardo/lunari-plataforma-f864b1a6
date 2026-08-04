import { SiteH2, SiteEyebrow, SiteLead, SiteReveal } from "../site/typography";
import { GhostLink } from "../site/primitives";
import { Zap } from "lucide-react";

export function Switching() {
  return (
    <section className="bg-site-graphite py-32 overflow-hidden relative">
      {/* Texture bg */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
      />

      <div className="mx-auto max-w-5xl px-6 lg:px-10 relative">
        <div className="bg-site-graphiteSoft border border-site-line-dark rounded-[48px] p-8 md:p-20 text-center">
          <SiteReveal>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-site-gold/10 border border-site-gold/20 mb-8">
              <Zap className="h-4 w-4 text-site-gold" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-site-gold">Migração Assistida</span>
            </div>
            
            <SiteH2 tone="dark">Vindo de outra plataforma?</SiteH2>
            
            <SiteLead tone="dark" className="mt-8 max-w-2xl mx-auto">
              Nossa equipe faz a migração dos seus dados (clientes e sessões) de graça para planos anuais. Você não precisa começar do zero.
            </SiteLead>

            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
              <GhostLink 
                to="/auth" 
                tone="dark"
                className="w-full sm:w-auto px-12"
              >
                Falar com um especialista
              </GhostLink>
              <p className="text-xs text-site-on-dark/40 italic">
                Aprovado por mais de 500 estúdios profissionais.
              </p>
            </div>
          </SiteReveal>
        </div>
      </div>
    </section>
  );
}
