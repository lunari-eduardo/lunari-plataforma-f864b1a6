import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SectionShell, EyebrowTag, Reveal, PrimaryButton, displayFont, uiFont } from "./primitives";

const plans = [
  {
    name: "Studio Starter",
    price: "R$ 79",
    cadence: "/mês",
    description: "Para quem está trocando planilha por sistema.",
    features: ["CRM + Agenda", "Contratos digitais", "Financeiro", "Workflow básico"],
    highlight: false,
  },
  {
    name: "Studio Pro",
    price: "R$ 149",
    cadence: "/mês",
    description: "O estúdio inteiro em um cérebro só.",
    features: [
      "Tudo do Starter",
      "Galeria unificada + Extras",
      "Assistente Lu (IA)",
      "WhatsApp nativo",
      "Relatórios avançados",
    ],
    highlight: true,
  },
];

export function PricingSection() {
  const nav = useNavigate();
  return (
    <SectionShell id="planos" className="bg-white">
      <Reveal>
        <div className="flex justify-center">
          <EyebrowTag>Planos honestos</EyebrowTag>
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <h2
          className="mx-auto mt-8 max-w-[860px] text-center text-[36px] leading-[1.05] tracking-[-0.025em] text-[#0B1B2B] md:text-[56px]"
          style={displayFont}
        >
          Você paga menos que uma sessão.{" "}
          <span className="italic text-[#C97B3A]">Ganha o estúdio inteiro.</span>
        </h2>
      </Reveal>

      <div className="mx-auto mt-16 grid max-w-[900px] grid-cols-1 gap-5 md:grid-cols-2">
        {plans.map((p, i) => (
          <Reveal key={p.name} delay={0.1 + i * 0.08}>
            <div
              className={`flex h-full flex-col rounded-[14px] border p-8 transition-all ${
                p.highlight
                  ? "border-[#0B1B2B] bg-[#0B1B2B] text-[#F5F1EA]"
                  : "border-[#0B1B2B]/12 bg-white text-[#0B1B2B] hover:border-[#0B1B2B]/25"
              }`}
              style={{
                boxShadow: p.highlight
                  ? "0 30px 60px -30px rgba(11,27,43,0.4)"
                  : "none",
              }}
            >
              <div className="flex items-center justify-between" style={uiFont}>
                <span className="text-[13px] uppercase tracking-[0.14em] opacity-70">
                  {p.name}
                </span>
                {p.highlight && (
                  <span className="rounded-full bg-[#C97B3A] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B1B2B]">
                    Recomendado
                  </span>
                )}
              </div>

              <div className="mt-6 flex items-baseline gap-1" style={displayFont}>
                <span className="text-[52px] leading-none tracking-[-0.03em]">{p.price}</span>
                <span className="text-[16px] opacity-60" style={uiFont}>
                  {p.cadence}
                </span>
              </div>

              <p className="mt-4 text-[15px] leading-[1.5] opacity-75" style={uiFont}>
                {p.description}
              </p>

              <ul className="mt-8 space-y-3" style={uiFont}>
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14px]">
                    <Check
                      className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                        p.highlight ? "text-[#C97B3A]" : "text-[#C97B3A]"
                      }`}
                      strokeWidth={2.5}
                    />
                    <span className="opacity-90">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 pt-4">
                <button
                  onClick={() => nav("/auth")}
                  className={`h-11 w-full rounded-[6px] text-[15px] font-semibold transition-all ${
                    p.highlight
                      ? "bg-[#C97B3A] text-[#0B1B2B] hover:brightness-105"
                      : "bg-[#0B1B2B] text-[#F5F1EA] hover:-translate-y-[1px]"
                  }`}
                  style={uiFont}
                >
                  Começar 30 dias grátis
                </button>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.35}>
        <p className="mt-10 text-center text-[13px] text-[#0B1B2B]/50" style={uiFont}>
          Sem cartão de crédito · Sem taxa de setup · Cancele quando quiser
        </p>
      </Reveal>
    </SectionShell>
  );
}
