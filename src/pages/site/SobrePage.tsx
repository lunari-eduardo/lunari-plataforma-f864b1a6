import { SEOHead } from "@/components/seo/SEOHead";
import {
  SectionShell,
  EyebrowTag,
  Reveal,
  GridLines,
  BreadcrumbTrail,
  CTABlock,
  displayFont,
  uiFont,
  monoFont,
} from "@/components/site/primitives";

export default function SobrePage() {
  return (
    <>
      <SEOHead
        title="Sobre · Lunari"
        description="Feita por fotógrafo, pra fotógrafo. A Lunari nasceu do cansaço de emendar 6 ferramentas pra rodar um estúdio."
        canonical="https://lunarihub.com/sobre"
        ogType="website"
      />

      <section className="relative overflow-hidden pt-36 pb-16 md:pt-44 md:pb-24">
        <GridLines />
        <div className="relative mx-auto max-w-[820px] px-6 md:px-8">
          <BreadcrumbTrail items={[{ label: "Início", to: "/" }, { label: "Sobre" }]} />
          <div className="mt-2">
            <Reveal>
              <EyebrowTag>Manifesto</EyebrowTag>
            </Reveal>
            <Reveal delay={0.05}>
              <h1
                className="mt-6 text-[44px] leading-[1.02] tracking-[-0.03em] md:text-[68px]"
                style={displayFont}
              >
                Fotógrafo não deveria virar <span className="italic text-[#b0632f]">planilheiro.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p
                className="mt-8 text-[18px] leading-[1.65] text-[#0A0A0A]/75 md:text-[20px]"
                style={uiFont}
              >
                A Lunari começou como um caderno. Depois virou planilha. Depois um Trello, um Notion, um WeTransfer,
                um Asaas, uma Pixieset. Cada ferramenta resolvia um pedaço. Nenhuma sabia da outra. O fotógrafo
                virava o cola entre elas.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <p
                className="mt-6 text-[18px] leading-[1.65] text-[#0A0A0A]/75 md:text-[20px]"
                style={uiFont}
              >
                Então a gente construiu um sistema que <b className="text-[#0A0A0A]">pensa como um estúdio</b>:
                agenda que sabe de dinheiro, galeria que sabe de contrato, financeiro que sabe de sessão. Uma verdade só.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <SectionShell className="border-t border-[rgba(10,10,10,0.08)]">
        <div className="grid gap-12 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Uma verdade",
              body:
                "Cliente, sessão, contrato e cobrança vivem no mesmo cérebro. Nada de conciliar planilhas.",
            },
            {
              n: "02",
              title: "Feito no Brasil",
              body:
                "PIX de verdade, Asaas, InfinitePay, MercadoPago, WhatsApp. Sem gambiarra com Stripe.",
            },
            {
              n: "03",
              title: "Sem taxa por foto",
              body:
                "Preço fixo. Se você entregar 5 mil fotos ou 500 mil, paga a mesma coisa.",
            },
          ].map((v, i) => (
            <Reveal key={v.n} delay={i * 0.08}>
              <div>
                <span
                  className="text-[11px] uppercase tracking-[0.22em] text-[#0A0A0A]/45"
                  style={monoFont}
                >
                  {v.n}
                </span>
                <h3
                  className="mt-4 text-[26px] leading-[1.15] tracking-[-0.02em]"
                  style={displayFont}
                >
                  {v.title}
                </h3>
                <p
                  className="mt-3 text-[15px] leading-[1.6] text-[#0A0A0A]/70"
                  style={uiFont}
                >
                  {v.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </SectionShell>

      <CTABlock
        title="Vem construir o estúdio"
        emphasis="do futuro."
        description="30 dias, sem cartão, sem promessa vazia."
        secondaryLabel="Falar com a Lunari"
        secondaryTo="/contato"
      />
    </>
  );
}
