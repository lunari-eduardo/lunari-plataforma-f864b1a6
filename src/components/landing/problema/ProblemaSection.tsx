import { EyebrowTag, Reveal, TOKENS, displayFont, uiFont } from "../primitives";
import { FragmentToEcosystem } from "./FragmentToEcosystem";

const LINES = [
  "Seu atendimento acontece no WhatsApp.",
  "Sua agenda está em outro lugar.",
  "Os contratos ficam em outro sistema.",
  "As cobranças em outro.",
  "As fotos em outro.",
];

export function ProblemaSection() {
  return (
    <section
      id="problema"
      className="relative w-full py-24 md:py-32"
      style={{ background: TOKENS.paper, color: TOKENS.ink }}
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-12">
          {/* Texto */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-[24vh]">
              <Reveal>
                <EyebrowTag index="01">O custo invisível</EyebrowTag>
              </Reveal>

              <Reveal delay={0.05}>
                <h2
                  className="mt-8 max-w-[520px] text-[34px] leading-[1.06] tracking-[-0.028em] md:text-[52px]"
                  style={{ ...uiFont, fontWeight: 600 }}
                >
                  O problema não é a falta de organização. É{" "}
                  <span
                    className="italic"
                    style={{ ...displayFont, color: TOKENS.ember, fontWeight: 400 }}
                  >
                    ter que organizar tudo sozinho.
                  </span>
                </h2>
              </Reveal>

              <div className="mt-10 flex max-w-[420px] flex-col gap-2.5">
                {LINES.map((line, i) => (
                  <Reveal key={line} delay={0.1 + i * 0.04}>
                    <p
                      className="text-[16px] leading-[1.7] md:text-[17px]"
                      style={{ ...uiFont, color: "rgba(10,10,10,0.62)" }}
                    >
                      {line}
                    </p>
                  </Reveal>
                ))}
              </div>

              <Reveal delay={0.34}>
                <div
                  className="mt-10 max-w-[420px] border-t pt-8"
                  style={{ borderColor: TOKENS.hair }}
                >
                  <p
                    className="text-[17px] leading-[1.6] md:text-[19px]"
                    style={{ ...uiFont, color: TOKENS.ink, fontWeight: 500 }}
                  >
                    No fim do dia, quem conecta tudo é você.
                  </p>
                  <p
                    className="mt-3 text-[16px] leading-[1.7] md:text-[17px]"
                    style={{ ...uiFont, color: "rgba(10,10,10,0.62)" }}
                  >
                    Enquanto você fotografa, o Lunari mantém tudo conectado e organizado.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Composição */}
          <div className="lg:col-span-7">
            <FragmentToEcosystem />
          </div>
        </div>
      </div>
    </section>
  );
}
