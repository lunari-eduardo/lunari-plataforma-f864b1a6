import { SectionShell, EyebrowTag, Reveal, displayFont, uiFont, monoFont } from "./primitives";

const questions = [
  "Quantas sessões fechei este mês?",
  "Quem ainda não pagou o extra?",
  "Qual cliente costuma voltar em novembro?",
  "Quanto entrou hoje, líquido, sem taxa?",
];

export function AISection() {
  return (
    <SectionShell id="ia" className="relative overflow-hidden bg-[#0A0A0A] text-[#FAFAF7]">
      {/* subtle warm glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-0 h-[500px] w-[700px] opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,90,31,0.35), transparent 70%)",
        }}
      />

      <div className="relative">
        <Reveal>
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
              <span className="h-1 w-1 rounded-full bg-[#FF5A1F]" />
              Assistente Lunari
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <h2
            className="mx-auto mt-8 max-w-[900px] text-center text-[36px] leading-[1.05] tracking-[-0.025em] md:text-[60px]"
            style={displayFont}
          >
            Sua planilha não te responde.{" "}
            <span className="italic text-[#FF5A1F]">A Lu responde.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p
            className="mx-auto mt-6 max-w-[600px] text-center text-[17px] leading-[1.55] text-white/60"
            style={uiFont}
          >
            Uma IA treinada no seu estúdio. Vê o que você tem agendado, faturado
            e pendente — e responde em português, sem SQL, sem relatório, sem
            desculpa.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mx-auto mt-16 max-w-[720px]">
            <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-2.5" style={uiFont}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF5A1F] text-[12px] font-semibold text-[#0A0A0A]" style={displayFont}>
                  Lu
                </span>
                <span className="text-[13px] text-white/60">respondendo agora</span>
              </div>

              <div className="space-y-3" style={monoFont}>
                {questions.map((q, i) => (
                  <div key={q} className="flex items-start gap-3 text-[13px]">
                    <span className="text-[#FF5A1F]/70">›</span>
                    <span className="text-white/80">{q}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-white/8 pt-5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/40" style={uiFont}>
                  Exemplo de resposta
                </div>
                <p
                  className="mt-3 text-[16px] leading-[1.5] text-white/90 md:text-[18px]"
                  style={displayFont}
                >
                  Este mês você fechou <span className="text-[#FF5A1F]">17 sessões</span>,
                  faturou <span className="text-[#FF5A1F]">R$ 24.380</span> líquido e
                  tem <span className="text-[#FF5A1F]">4 clientes</span> com extras
                  vencidos. Quer que eu prepare a régua de cobrança?
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.3}>
          <p
            className="mx-auto mt-14 max-w-[640px] text-center text-[15px] text-white/50"
            style={uiFont}
          >
            A Lu nunca age sem sua confirmação. Toda ação sensível pede autorização — porque
            estúdio se ganha com <span className="italic text-white/70">controle</span>, não
            com automação cega.
          </p>
        </Reveal>
      </div>
    </SectionShell>
  );
}
