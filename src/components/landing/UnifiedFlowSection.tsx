import { ArrowRight } from "lucide-react";
import { SectionShell, EyebrowTag, Reveal, displayFont, uiFont } from "./primitives";

const flow = [
  { label: "Lead", detail: "captura automática" },
  { label: "Orçamento", detail: "template inteligente" },
  { label: "Agenda", detail: "confirmado 14:02" },
  { label: "Contrato", detail: "assinado digitalmente" },
  { label: "Sessão", detail: "workflow iniciado" },
  { label: "Galeria", detail: "cliente selecionou" },
  { label: "Pós-venda", detail: "recorrência ativa" },
];

export function UnifiedFlowSection() {
  return (
    <SectionShell id="produto" className="bg-white">
      <Reveal>
        <div className="flex justify-center">
          <EyebrowTag>Uma nova forma de administrar</EyebrowTag>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <h2
          className="mx-auto mt-8 max-w-[860px] text-center text-[36px] leading-[1.05] tracking-[-0.025em] text-[#0B1B2B] md:text-[56px]"
          style={displayFont}
        >
          Um cliente entra.{" "}
          <span className="italic text-[#C97B3A]">Um fluxo o leva ao pós-venda.</span>
        </h2>
      </Reveal>

      <Reveal delay={0.1}>
        <p
          className="mx-auto mt-6 max-w-[580px] text-center text-[17px] leading-[1.55] text-[#0B1B2B]/60"
          style={uiFont}
        >
          CRM, agenda, contratos, financeiro, galeria e IA deixam de funcionar
          como ferramentas separadas e passam a trabalhar como um único sistema.
        </p>
      </Reveal>

      {/* Horizontal flow */}
      <Reveal delay={0.2}>
        <div className="mt-20 hidden md:block">
          <div className="relative">
            <div className="absolute left-6 right-6 top-[26px] h-px bg-[#0B1B2B]/10" />
            <div
              className="absolute left-6 top-[26px] h-px bg-[#C97B3A]"
              style={{ width: "62%" }}
            />
            <div className="relative grid grid-cols-7 gap-2">
              {flow.map((step, i) => {
                const active = i < 5;
                return (
                  <div key={step.label} className="flex flex-col items-center text-center">
                    <div
                      className={`flex h-[52px] w-[52px] items-center justify-center rounded-full border transition-all ${
                        active
                          ? "border-[#C97B3A] bg-[#F5F1EA]"
                          : "border-[#0B1B2B]/15 bg-white"
                      }`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${
                          active ? "bg-[#C97B3A]" : "bg-[#0B1B2B]/25"
                        }`}
                      />
                    </div>
                    <div
                      className={`mt-4 text-[13px] font-semibold ${
                        active ? "text-[#0B1B2B]" : "text-[#0B1B2B]/45"
                      }`}
                      style={uiFont}
                    >
                      {step.label}
                    </div>
                    <div
                      className="mt-1 text-[11px] text-[#0B1B2B]/45"
                      style={uiFont}
                    >
                      {step.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="mt-14 flex flex-col gap-3 md:hidden" style={uiFont}>
          {flow.map((step, i) => (
            <div
              key={step.label}
              className="flex items-center justify-between rounded-[10px] border border-[#0B1B2B]/10 bg-[#F5F1EA]/40 px-4 py-3"
            >
              <div>
                <div className="text-[14px] font-semibold text-[#0B1B2B]">{step.label}</div>
                <div className="text-[12px] text-[#0B1B2B]/50">{step.detail}</div>
              </div>
              {i < flow.length - 1 && (
                <ArrowRight className="h-4 w-4 text-[#0B1B2B]/25" />
              )}
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.3}>
        <p
          className="mt-16 text-center text-[18px] text-[#0B1B2B] md:text-[22px]"
          style={displayFont}
        >
          Todo o estúdio atualizado.{" "}
          <span className="italic text-[#C97B3A]">Em uma ação.</span>
        </p>
      </Reveal>
    </SectionShell>
  );
}
