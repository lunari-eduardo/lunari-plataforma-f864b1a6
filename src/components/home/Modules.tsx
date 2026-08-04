import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SiteH2, SiteEyebrow, SiteReveal } from "../site/typography";
import { SITE_COLORS } from "../site/theme";

export function Modules() {
  const modules = [
    { 
      title: "CRM", 
      desc: "Gestão completa de contatos e histórico de interações.",
      tags: ["Leads", "Funil", "WhatsApp"]
    },
    { 
      title: "Agenda", 
      desc: "Sincronização com Google e reserva online por link.",
      tags: ["Slots", "Google Sync", "Prazos"]
    },
    { 
      title: "Financeiro", 
      desc: "Controle de fluxo de caixa, DRE e automação de cobrança.",
      tags: ["Asaas", "Pix", "Cartão"]
    },
    { 
      title: "Workflow", 
      desc: "Acompanhamento visual de cada etapa da produção.",
      tags: ["Kanban", "Status", "Realtime"]
    },
    { 
      title: "Gallery", 
      desc: "Seleção e entrega de fotos com marca d'água.",
      tags: ["R2 Storage", "Download ZIP", "Extras"]
    },
    { 
      title: "IA (Lu)", 
      desc: "Sua assistente que gera orçamentos e responde dúvidas.",
      tags: ["Automação", "NLP", "Insights"]
    }
  ];

  return (
    <section id="modulos" data-tone="light" className="bg-site-offwhite py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SiteReveal>
          <SiteEyebrow>O ecossistema completo</SiteEyebrow>
          <SiteH2 tone="light" className="max-w-2xl">
            Tudo o que seu estúdio precisa, operando em uma só órbita.
          </SiteH2>
        </SiteReveal>

        <div className="mt-20 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m, i) => (
            <SiteReveal key={m.title} delay={i * 50}>
              <div className="group bg-site-warmwhite border border-site-line-light p-8 rounded-2xl hover:border-site-gold transition-all hover:-translate-y-1">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-xl bg-site-gold/10 flex items-center justify-center text-site-gold font-bold">
                    0{i + 1}
                  </div>
                  <div className="flex gap-1">
                    {m.tags.map(t => (
                      <span key={t} className="text-[10px] font-mono uppercase tracking-wider text-site-ink/40 border border-site-line-light px-2 py-0.5 rounded-md">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-site-ink mb-3 group-hover:text-site-gold transition-colors">{m.title}</h3>
                <p className="text-sm text-site-ink/60 leading-relaxed">{m.desc}</p>
              </div>
            </SiteReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
