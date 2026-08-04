import { ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";
import { SiteH2, SiteEyebrow, SiteLead, SiteReveal } from "../site/typography";
import { NavLink } from "react-router-dom";

export function Tour() {
  const steps = [
    { title: "Lead", desc: "Captura inteligente de interesse com formulários que já qualificam o cliente." },
    { title: "Orçamento", desc: "Propostas enviadas em segundos, com aceite online e contrato automático." },
    { title: "Agendamento", desc: "Reserva de data com link de pagamento de confirmação integrado." },
    { title: "Sessão", desc: "Workflow guia a produção, sem deixar nenhuma tarefa esquecida." },
    { title: "Entrega", desc: "Galeria Select cobra extras sozinha e Transfer entrega o ZIP final." }
  ];

  return (
    <section id="tour" data-tone="dark" className="bg-site-graphite py-20 md:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SiteReveal>
          <SiteEyebrow>O fluxo perfeito</SiteEyebrow>
          <SiteH2 tone="dark" className="max-w-2xl">
            Do primeiro contato à entrega final, em uma linha contínua.
          </SiteH2>
        </SiteReveal>

        <div className="mt-20 relative">
          {/* Linha conectora */}
          <div className="absolute top-[45px] left-0 right-0 h-px bg-site-line-dark hidden md:block" />
          
          <div className="grid md:grid-cols-5 gap-12 relative">
            {steps.map((step, i) => (
              <SiteReveal key={step.title} delay={i * 100}>
                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                  <div className="w-24 h-24 rounded-2xl bg-site-graphiteSoft border border-site-line-dark flex items-center justify-center mb-6 shadow-xl group hover:border-site-gold transition-colors">
                    <span className="text-xl font-bold text-site-on-dark/40 group-hover:text-site-gold transition-colors">{i + 1}</span>
                  </div>
                  <h4 className="text-lg font-bold text-site-on-dark mb-3">{step.title}</h4>
                  <p className="text-sm text-site-on-dark/50 leading-relaxed">{step.desc}</p>
                </div>
              </SiteReveal>
            ))}
          </div>
        </div>

        <SiteReveal delay={600} className="mt-24 flex justify-center">
          <NavLink 
            to="/auth" 
            className="group flex items-center gap-4 bg-site-graphiteSoft border border-site-line-dark px-8 py-4 rounded-full text-site-on-dark hover:border-site-gold transition-all"
          >
            <span>Conhecer o fluxo detalhado</span>
            <div className="w-8 h-8 rounded-full bg-site-gold/10 flex items-center justify-center text-site-gold group-hover:bg-site-gold group-hover:text-site-graphite transition-all">
              →
            </div>
          </NavLink>
        </SiteReveal>
      </div>
    </section>
  );
}
