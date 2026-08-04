import { ReactNode } from "react";
import { SiteH1, SiteLead, SiteReveal } from "./typography";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-site-graphite pt-32 pb-20 md:pt-48 md:pb-32">
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-site-gold/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[400px] bg-site-gold/5 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-2 gap-16 items-center">
        <SiteReveal>
          <SiteH1 tone="dark" emphasis="Não adaptado.">
            Feito para fotógrafo.
          </SiteH1>
          <SiteLead tone="dark" className="mt-8 max-w-xl">
            CRM, agenda, contratos, financeiro, galeria e um assistente de IA — todos os módulos do seu estúdio, rodando em tempo real, na mesma base de dados.
          </SiteLead>
          <div className="mt-12 flex flex-wrap gap-4">
            <a 
              href="/auth" 
              className="bg-site-gold text-site-graphite px-8 py-4 rounded-full font-bold text-sm hover:bg-site-goldPale transition-all hover:-translate-y-1"
            >
              TESTAR GRÁTIS
            </a>
            <a 
              href="#modulos" 
              className="border border-site-line-dark text-site-on-dark px-8 py-4 rounded-full font-bold text-sm hover:border-site-gold transition-all"
            >
              VER MÓDULOS
            </a>
          </div>
        </SiteReveal>

        <SiteReveal delay={200} className="relative">
          <div className="aspect-[4/3] rounded-2xl bg-site-graphiteSoft border border-site-line-dark shadow-2xl overflow-hidden p-2">
            <div className="w-full h-full rounded-xl bg-site-graphite flex items-center justify-center">
              <img 
                src="/api/placeholder/800/600" 
                alt="Lunari Studio Interface"
                className="w-full h-full object-cover opacity-80"
              />
            </div>
          </div>
          {/* Badge flutuante decorativo */}
          <div className="absolute -bottom-6 -left-6 bg-site-graphiteSoft/90 backdrop-blur border border-site-line-dark p-6 rounded-2xl shadow-xl hidden lg:block">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-site-gold/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-site-gold animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-site-gold">Status</p>
                <p className="text-sm font-semibold text-site-on-dark">Estúdio em órbita</p>
              </div>
            </div>
          </div>
        </SiteReveal>
      </div>
    </section>
  );
}
