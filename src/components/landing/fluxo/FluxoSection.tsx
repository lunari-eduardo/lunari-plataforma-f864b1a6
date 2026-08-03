import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { EASE, TOKENS, monoFont, uiFont } from "../primitives";
import fluxoImg from "@/assets/home-fluxo.jpg";

const SITE_LIGHT = "#F7F5F2";
const SITE_DARK = "#0B0B0B";

const STEPS = [
  {
    n: "01",
    title: "Lead",
    desc: "O contato chega e já entra no fluxo — sem planilha para preencher depois.",
  },
  {
    n: "02",
    title: "Agenda",
    desc: "A sessão já entra no calendário com todas as informações necessárias.",
  },
  {
    n: "03",
    title: "Contrato",
    desc: "Pré-preenchido com os dados do atendimento e pronto para assinatura digital.",
  },
  {
    n: "04",
    title: "Sessão",
    desc: "Tudo o que foi combinado continua disponível.",
  },
  {
    n: "05",
    title: "Galeria de seleção",
    desc: "Criada automaticamente e vinculada ao cliente e à sessão.",
  },
  {
    n: "06",
    title: "Pagamentos",
    desc: "Tudo permanece vinculado e atualizado em tempo real.",
  },
  {
    n: "07",
    title: "Entrega",
    desc: "A entrega continua conectada ao cliente e ao histórico do atendimento.",
  },
];

function Fade({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function FluxoSection() {
  const reduce = useReducedMotion();
  const timelineRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(reduce ? STEPS.length - 1 : -1);

  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 72%", "end 62%"],
  });
  const dotTop = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduce) return;
    const idx = Math.min(STEPS.length - 1, Math.floor(v * STEPS.length + 0.15));
    setActive(v <= 0 ? -1 : idx);
  });

  return (
    <section
      id="fluxo"
      className="relative w-full py-28 md:py-40"
      style={{ background: SITE_LIGHT, color: SITE_DARK }}
    >
      <div className="mx-auto w-full max-w-[1180px] px-6 md:px-10">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-[45fr_55fr] md:items-start md:gap-20 lg:gap-24">
          {/* Texto + timeline — esquerda no desktop */}
          <div className="order-1">
            <Fade>
              <p
                className="text-[11px] uppercase tracking-[0.26em] md:text-[12px]"
                style={{ ...monoFont, color: "rgba(11,11,11,0.45)" }}
              >
                <span style={{ color: TOKENS.gold }}>•</span> O FLUXO
              </p>
            </Fade>

            <Fade delay={0.08}>
              <h2
                className="mt-8 max-w-[520px] text-[32px] leading-[1.06] tracking-[-0.03em] md:text-[48px]"
                style={{ ...uiFont, fontWeight: 600, color: SITE_DARK }}
              >
                Uma única linha.
                <br />
                Do primeiro contato à entrega.
              </h2>
            </Fade>

            <Fade delay={0.14}>
              <p
                className="mt-6 max-w-[430px] text-[17px] leading-[1.7] md:text-[18px]"
                style={{ ...uiFont, color: "rgba(11,11,11,0.6)" }}
              >
                Cada etapa continua exatamente de onde a anterior terminou.
              </p>
            </Fade>

            {/* Timeline */}
            <ol ref={timelineRef} className="relative mt-14 pl-8 md:mt-16">
              {/* linha 1px */}
              <span
                aria-hidden
                className="absolute left-[3px] top-1 bottom-1 w-px"
                style={{ background: "rgba(11,11,11,0.14)" }}
              />
              {/* ponto dourado */}
              {!reduce && (
                <motion.span
                  aria-hidden
                  className="absolute left-0 top-1 h-[7px] w-[7px] rounded-full"
                  style={{
                    background: TOKENS.gold,
                    top: dotTop,
                    marginTop: "2px",
                  }}
                />
              )}

              {STEPS.map((step, i) => {
                const on = reduce || i <= active;
                return (
                  <li key={step.n} className="pb-9 last:pb-0 md:pb-10">
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-[10px] tracking-[0.2em] transition-colors duration-500"
                        style={{
                          ...monoFont,
                          color: on ? TOKENS.gold : "rgba(11,11,11,0.25)",
                        }}
                      >
                        {step.n}
                      </span>
                      <span
                        className="text-[16px] transition-colors duration-500 md:text-[17px]"
                        style={{
                          ...uiFont,
                          fontWeight: 500,
                          color: on ? SITE_DARK : "rgba(11,11,11,0.4)",
                        }}
                      >
                        {step.title}
                      </span>
                    </div>
                    <p
                      className="mt-2 max-w-[400px] text-[14px] leading-[1.7] transition-opacity duration-700 md:text-[15px]"
                      style={{
                        ...uiFont,
                        color: "rgba(11,11,11,0.55)",
                        opacity: on ? 1 : 0.18,
                      }}
                    >
                      {step.desc}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Visual — direita no desktop, por último no mobile */}
          <div className="order-2">
            <Fade delay={0.06}>
              <div className="w-full overflow-hidden aspect-[4/5] md:sticky md:top-24">
                <img
                  src={fluxoImg}
                  alt="Composição editorial com cartão, agenda impressa, contrato com selo dourado, recibo e prova fotográfica alinhados em sequência"
                  width={1024}
                  height={1280}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
            </Fade>
          </div>
        </div>
      </div>
    </section>
  );
}
