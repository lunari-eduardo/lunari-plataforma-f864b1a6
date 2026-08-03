import { SectionShell, EyebrowTag, Reveal, displayFont, uiFont } from "./primitives";

const pains = [
  { tool: "Planilha", for: "orçamento" },
  { tool: "WhatsApp", for: "conversa" },
  { tool: "Google Agenda", for: "sessão" },
  { tool: "Drive", for: "galeria" },
  { tool: "Banco", for: "cobrança" },
  { tool: "Cabeça", for: "lembrar de tudo" },
];

export function ProblemSection() {
  return (
    <SectionShell tone="light">
      <Reveal>
        <div className="flex justify-center">
          <EyebrowTag>O custo invisível</EyebrowTag>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <h2
          className="mx-auto mt-8 max-w-[860px] text-center text-[36px] leading-[1.05] tracking-[-0.025em] text-[#0A0A0A] md:text-[56px]"
          style={displayFont}
        >
          Você não tem problema de clientes.{" "}
          <span className="italic" style={{ color: "#C9A87C" }}>Tem problema de sistema.</span>
        </h2>
      </Reveal>

      <div className="mx-auto mt-14 max-w-[720px]">
        {pains.map((p, i) => (
          <Reveal key={p.tool} delay={0.08 + i * 0.04}>
            <div
              className="flex items-baseline justify-between border-b border-[#0A0A0A]/8 py-5"
              style={uiFont}
            >
              <span
                className="text-[22px] font-medium text-[#0A0A0A] md:text-[26px]"
                style={displayFont}
              >
                {p.tool}
              </span>
              <span className="text-[13px] uppercase tracking-[0.14em] text-[#0A0A0A]/50">
                para {p.for}
              </span>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.5}>
        <div className="mx-auto mt-14 max-w-[720px] text-center">
          <div className="flex items-center justify-center gap-8" style={uiFont}>
            <Stat n="5" label="abas abertas" />
            <div className="h-8 w-px bg-[#0A0A0A]/10" />
            <Stat n="14h" label="por semana" />
            <div className="h-8 w-px bg-[#0A0A0A]/10" />
            <Stat n="0" label="visão real" />
          </div>
          <p
            className="mt-10 text-[20px] italic md:text-[24px]"
            style={{ ...displayFont, color: "#C9A87C" }}
          >
            Isso não é organização. É sobrevivência.
          </p>
        </div>
      </Reveal>
    </SectionShell>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div
        className="text-[32px] font-medium text-[#0A0A0A] md:text-[40px]"
        style={displayFont}
      >
        {n}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#0A0A0A]/50">
        {label}
      </div>
    </div>
  );
}
