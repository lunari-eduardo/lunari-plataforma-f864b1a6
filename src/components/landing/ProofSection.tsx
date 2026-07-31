import { Check } from "lucide-react";
import { SectionShell, EyebrowTag, Reveal, TOKENS, displayFont, uiFont } from "./primitives";

/**
 * Seção de garantias do produto (tema dark).
 *
 * Substitui as antigas métricas e o depoimento — em fase de lançamento,
 * prova social não verificável enfraquece a página. Aqui ficam apenas
 * afirmações verdadeiras sobre o que o sistema entrega hoje.
 */
const PILLARS: { title: string; desc: string }[] = [
  {
    title: "Um cadastro, o fluxo inteiro",
    desc: "Lead, sessão, contrato, cobrança e galeria compartilham o mesmo cliente. Nada é digitado duas vezes.",
  },
  {
    title: "Dinheiro sempre conferido",
    desc: "Pagamentos, extras e parcelas caem no financeiro no instante em que acontecem, com extrato rastreável.",
  },
  {
    title: "Entrega com a sua marca",
    desc: "Seleção e transferência de fotos em galerias próprias, com cobrança automática de extras.",
  },
];

export function ProofSection() {
  return (
    <SectionShell tone="dark" className="overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 h-[360px] w-[520px] opacity-[0.12] blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${TOKENS.gold}, transparent 70%)` }}
      />

      <Reveal>
        <div className="flex justify-center">
          <EyebrowTag tone="dark">O que você leva</EyebrowTag>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <h2
          className="mx-auto mt-8 max-w-[820px] text-center text-[32px] leading-[1.08] tracking-[-0.03em] md:text-[48px]"
          style={{ ...uiFont, color: TOKENS.onDark, fontWeight: 600 }}
        >
          Um estúdio inteiro{" "}
          <span className="italic font-normal" style={{ ...displayFont, color: TOKENS.gold }}>
            em uma tela
          </span>
          .
        </h2>
      </Reveal>

      <div className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-3">
        {PILLARS.map((p, i) => (
          <Reveal key={p.title} delay={0.1 + i * 0.08}>
            <div
              className="h-full rounded-[14px] border p-6"
              style={{ borderColor: TOKENS.hairDark, background: TOKENS.obsidianSoft }}
            >
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border"
                style={{ borderColor: "rgba(201,168,124,0.35)" }}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: TOKENS.gold }} />
              </span>
              <div
                className="mt-5 text-[17px] font-medium tracking-[-0.01em]"
                style={{ ...uiFont, color: TOKENS.onDark }}
              >
                {p.title}
              </div>
              <p
                className="mt-2.5 text-[14px] leading-[1.6]"
                style={{ ...uiFont, color: TOKENS.onDarkMuted }}
              >
                {p.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
