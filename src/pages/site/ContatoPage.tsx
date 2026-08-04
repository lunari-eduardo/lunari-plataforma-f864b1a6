import { SEOHead } from "@/components/seo/SEOHead";
import {
  SectionShell,
  EyebrowTag,
  Reveal,
  GridLines,
  BreadcrumbTrail,
  PrimaryButton,
  displayFont,
  uiFont,
  monoFont,
} from "@/components/site/primitives";
import { Mail, MessageCircle, Instagram } from "lucide-react";

const WA = "5551998287948";
const EMAIL = "contato@lunarihub.com";
const IG = "https://instagram.com/app.lunari";

export default function ContatoPage() {
  const waHref = `https://wa.me/${WA}?text=${encodeURIComponent(
    "Oi Lunari! Quero saber mais.",
  )}`;
  return (
    <>
      <SEOHead
        title="Contato · Lunari"
        description="Fale com a Lunari por WhatsApp, e-mail ou Instagram. Respondemos em horário comercial."
        canonical="https://lunarihub.com/contato"
        ogType="website"
      />

      <section className="relative overflow-hidden pt-36 pb-16 md:pt-44 md:pb-20">
        <GridLines />
        <div className="relative mx-auto max-w-[900px] px-6 md:px-8">
          <BreadcrumbTrail items={[{ label: "Início", to: "/" }, { label: "Contato" }]} />
          <div className="mt-2">
            <Reveal>
              <EyebrowTag>Contato</EyebrowTag>
            </Reveal>
            <Reveal delay={0.05}>
              <h1
                className="mt-6 text-[44px] leading-[1.02] tracking-[-0.03em] md:text-[72px]"
                style={displayFont}
              >
                Fala com a <span className="italic" style={{ color: "#C9A87C" }}>gente.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p
                className="mt-6 max-w-[560px] text-[17px] leading-[1.55] text-[#0A0A0A]/85 md:text-[19px]"
                style={uiFont}
              >
                Sem formulário chato. Escolhe o canal que preferir. Respondemos rápido em horário comercial (SP).
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <SectionShell>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: MessageCircle,
              label: "WhatsApp",
              hint: "Resposta média · 15 min",
              action: "Abrir conversa",
              href: waHref,
            },
            {
              icon: Mail,
              label: EMAIL,
              hint: "E-mail comercial e suporte",
              action: "Enviar e-mail",
              href: `mailto:${EMAIL}`,
            },
            {
              icon: Instagram,
              label: "@app.lunari",
              hint: "DM aberto, bastidores e novidades",
              action: "Abrir Instagram",
              href: IG,
            },
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.label} delay={i * 0.06}>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex h-full flex-col rounded-[16px] border border-[rgba(10,10,10,0.08)] bg-white p-8 transition-colors hover:border-[#0A0A0A]"
                >
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#0A0A0A] text-[#FAFAF7] transition-transform group-hover:scale-105"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <p
                    className="mt-6 text-[10px] uppercase tracking-[0.18em] text-[#0A0A0A]/60"
                    style={monoFont}
                  >
                    {c.hint}
                  </p>
                  <h3
                    className="mt-2 text-[22px] leading-[1.2] tracking-[-0.015em]"
                    style={displayFont}
                  >
                    {c.label}
                  </h3>
                  <span
                    className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0A0A0A]"
                    style={uiFont}
                  >
                    {c.action} →
                  </span>
                </a>
              </Reveal>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell className="border-t border-[rgba(10,10,10,0.08)] text-center">
        <Reveal>
          <h2
            className="text-[32px] leading-[1.05] tracking-[-0.025em] md:text-[44px]"
            style={displayFont}
          >
            Já sabe que quer testar?
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-8 flex justify-center">
            <PrimaryButton onClick={() => (window.location.href = "/auth")}>
              Testar 30 dias grátis
            </PrimaryButton>
          </div>
        </Reveal>
      </SectionShell>
    </>
  );
}
