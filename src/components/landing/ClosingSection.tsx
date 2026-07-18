import { useNavigate } from "react-router-dom";
import { SectionShell, Reveal, PrimaryButton, displayFont, uiFont } from "./primitives";

export function ClosingSection() {
  const nav = useNavigate();
  return (
    <SectionShell className="relative overflow-hidden bg-[#0A0A0A] text-[#FAFAF7]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px] opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side at 50% 0%, rgba(255,90,31,0.35), transparent 70%)",
        }}
      />
      <div className="relative text-center">
        <Reveal>
          <h2
            className="mx-auto max-w-[900px] text-[42px] leading-[1.05] tracking-[-0.025em] md:text-[76px]"
            style={displayFont}
          >
            Você não precisa de mais uma ferramenta.
            <br />
            <span className="italic text-[#FF5A1F]">Precisa de um estúdio que pensa com você.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => nav("/auth")}
              className="h-12 rounded-[6px] bg-[#FF5A1F] px-8 text-[16px] font-semibold text-[#0A0A0A] transition-all hover:-translate-y-[1px] hover:brightness-105"
              style={uiFont}
            >
              Começar 30 dias grátis
            </button>
            <a
              href="#planos"
              className="text-[15px] font-medium text-white/60 hover:text-white"
              style={uiFont}
            >
              Ver planos →
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.25}>
          <p className="mt-8 text-[13px] text-white/40" style={uiFont}>
            Sem cartão · Sem contrato · Sem drama
          </p>
        </Reveal>
      </div>
    </SectionShell>
  );
}
