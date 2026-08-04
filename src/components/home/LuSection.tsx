import { useState, useEffect } from "react";
import { SiteH2, SiteEyebrow, SiteLead, SiteReveal } from "../site/typography";
import { Sparkles } from "lucide-react";

const LU_MESSAGE = "Lu, gere um orçamento para ensaio newborn em estúdio, com álbum de 20 páginas e entrega em 15 dias.";
const LU_REPLY = "Com certeza! Gerando proposta para Ensaio Newborn Premium. Valor base R$ 1.200, álbum R$ 450. Link de reserva criado.";

export function LuSection() {
  const [typed, setTyped] = useState("");
  const [showReply, setShowReply] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTyped(LU_MESSAGE.slice(0, i));
      i++;
      if (i > LU_MESSAGE.length) {
        clearInterval(interval);
        setTimeout(() => setShowReply(true), 800);
      }
    }, 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="lu" data-tone="dark" className="bg-site-graphite py-20 md:py-32 overflow-hidden relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-site-gold/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-16 items-center">
          <SiteReveal>
            <SiteEyebrow>Assistente de IA</SiteEyebrow>
            <SiteH2 tone="dark">
              Lu. A inteligência que trabalha enquanto você fotografa.
            </SiteH2>
            <SiteLead tone="dark" className="mt-8">
              Não é um chatbot genérico. Lu está conectada à sua base de dados, conhece seus preços e entende seu fluxo.
            </SiteLead>
          </SiteReveal>

          <SiteReveal delay={200} className="relative">
            <div className="bg-site-graphiteSoft border border-site-line-dark rounded-3xl p-6 md:p-10 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-site-line-dark pb-6 mb-6">
                <div className="w-10 h-10 rounded-full bg-site-gold/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-site-gold" />
                </div>
                <div>
                  <p className="text-sm font-bold text-site-on-dark">Assistente Lu</p>
                  <p className="text-[10px] uppercase tracking-widest text-site-gold">Conectada</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-site-graphite border border-site-line-dark p-4 rounded-2xl rounded-tl-none text-sm text-site-on-dark/80">
                  {typed}
                  <span className="inline-block w-1 h-4 bg-site-gold ml-1 animate-pulse" />
                </div>

                {showReply && (
                  <SiteReveal className="bg-site-gold/10 border border-site-gold/20 p-4 rounded-2xl rounded-tr-none text-sm text-site-on-dark">
                    <p className="font-bold text-site-gold mb-1">Lu:</p>
                    {LU_REPLY}
                  </SiteReveal>
                )}
              </div>
            </div>
          </SiteReveal>
        </div>
      </div>
    </section>
  );
}
