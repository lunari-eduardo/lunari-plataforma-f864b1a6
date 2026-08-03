import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { EASE, TOKENS, monoFont, uiFont } from "../primitives";

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
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(reduce ? STEPS.length - 1 : -1);

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  const dotTop = useTransform(scrollYProgress, [0.06, 0.94], ["0%", "100%"], {
    clamp: true,
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduce) return;
    const p = (v - 0.06) / 0.88;
    if (p <= 0) {
      setActive(-1);
      return;
    }
    setActive(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length + 0.12)));
  });

  const header = (
    <div>
      <Fade>
        <p
          className="text-[10px] uppercase tracking-[0.26em] md:text-[12px]"
          style={{ ...monoFont, color: "rgba(11,11,11,0.45)" }}
        >
          <span style={{ color: TOKENS.gold }}>•</span> O FLUXO
        </p>
      </Fade>

      <Fade delay={0.08}>
        <h2
          className="mt-4 max-w-[520px] text-[26px] leading-[1.08] tracking-[-0.03em] md:mt-8 md:text-[48px]"
          style={{ ...uiFont, fontWeight: 600, color: SITE_DARK }}
        >
          Uma única linha.
          <br />
          Do primeiro contato à entrega.
        </h2>
      </Fade>

      <Fade delay={0.14}>
        <p
          className="mt-3 max-w-[430px] text-[14px] leading-[1.6] md:mt-6 md:text-[18px] md:leading-[1.7]"
          style={{ ...uiFont, color: "rgba(11,11,11,0.6)" }}
        >
          Cada etapa continua exatamente de onde a anterior terminou.
        </p>
      </Fade>
    </div>
  );

  const timeline = (
    <ol className="relative flex h-full flex-col justify-between pl-6 md:pl-8">
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
          className="absolute left-0 h-[7px] w-[7px] rounded-full"
          style={{ background: TOKENS.gold, top: dotTop, marginTop: "2px" }}
        />
      )}

      {STEPS.map((step, i) => {
        const on = reduce || i <= active;
        return (
          <li key={step.n}>
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
                className="text-[15px] transition-colors duration-500 md:text-[17px]"
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
              className="mt-1 max-w-[400px] text-[12.5px] leading-[1.5] transition-opacity duration-700 md:mt-2 md:text-[15px] md:leading-[1.7]"
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
  );

  if (reduce) {
    return (
      <section
        id="fluxo"
        className="relative w-full"
        style={{ background: SITE_LIGHT, color: SITE_DARK }}
      >
        <div className="mx-auto w-full max-w-[1180px] px-6 py-24 md:px-10 md:py-40">
          {header}
          <div className="mt-12 space-y-8">{timeline}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="fluxo"
      className="relative w-full"
      style={{ background: SITE_LIGHT, color: SITE_DARK }}
    >
      {/* Trilho de scroll travado — mobile e desktop */}
      <div
        ref={trackRef}
        className="relative h-[220vh] md:h-[260vh]"
      >
        <div className="sticky top-0 mx-auto flex h-[100svh] w-full max-w-[1180px] flex-col justify-center gap-6 px-6 py-8 md:h-screen md:flex-row md:items-center md:gap-20 md:px-10 md:py-0 lg:gap-24">
          <div className="md:w-[42%] md:shrink-0">{header}</div>
          <div className="min-h-0 flex-1 md:h-[90vh] md:max-h-[820px] md:flex-none md:w-[58%]">
            {timeline}
          </div>
        </div>
      </div>
    </section>
  );
}
