import { SectionShell, Reveal, displayFont, uiFont } from "./primitives";

export function ProofSection() {
  return (
    <SectionShell className="bg-[#FAFAF7]">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <Reveal>
          <Metric n="R$ 38k" label="recuperados em extras esquecidos" />
        </Reveal>
        <Reveal delay={0.1}>
          <Metric n="14h" label="devolvidas por semana ao fotógrafo" />
        </Reveal>
        <Reveal delay={0.2}>
          <Metric n="0" label="planilha, calendário externo, drive" />
        </Reveal>
      </div>

      <Reveal delay={0.3}>
        <blockquote
          className="mx-auto mt-24 max-w-[820px] text-center text-[26px] leading-[1.35] text-[#0A0A0A] md:text-[34px]"
          style={displayFont}
        >
          "Não é software. É a primeira vez que eu enxergo{" "}
          <em className="italic text-[#b0632f]">o estúdio inteiro</em> em uma tela."
        </blockquote>
        <p className="mt-6 text-center text-[13px] uppercase tracking-[0.16em] text-[#0A0A0A]/50" style={uiFont}>
          Isabela — estúdio de família, Curitiba
        </p>
      </Reveal>
    </SectionShell>
  );
}

function Metric({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-center">
      <div
        className="text-[56px] leading-none tracking-[-0.03em] text-[#0A0A0A] md:text-[80px]"
        style={displayFont}
      >
        {n}
      </div>
      <div
        className="mx-auto mt-4 max-w-[220px] text-[14px] leading-[1.4] text-[#0A0A0A]/60"
        style={uiFont}
      >
        {label}
      </div>
    </div>
  );
}
