import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { EASE, TOKENS, monoFont, uiFont } from "../primitives";
import rotinaImg from "@/assets/home-rotina.jpg";

const SITE_LIGHT = "#F7F5F2";
const SITE_DARK = "#0B0B0B";

const GROUP_A = [
  "Um estúdio cresce quando os clientes chegam.",
  "Mas a operação cresce junto.",
];

const GROUP_B = [
  "Foi entendendo essa realidade que o Lunari nasceu.",
  "Não para reinventar a forma de fotografar.",
  "Mas para organizar tudo o que acontece antes, durante e depois de cada ensaio.",
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

export function RotinaSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-3%", "3%"]);

  return (
    <section
      id="rotina"
      className="relative w-full py-28 md:py-44"
      style={{ background: SITE_LIGHT, color: SITE_DARK }}
    >
      <div className="mx-auto w-full max-w-[1180px] px-6 md:px-10">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-[56fr_44fr] md:items-center md:gap-20 lg:gap-24">
          {/* Texto — 2º no mobile, direita no desktop */}
          <div className="order-1 md:order-2">
            <Fade>
              <p
                className="text-[11px] uppercase tracking-[0.26em] md:text-[12px]"
                style={{ ...monoFont, color: "rgba(11,11,11,0.45)" }}
              >
                <span style={{ color: TOKENS.ember }}>•</span> UMA ROTINA QUE CRESCE
              </p>
            </Fade>

            <Fade delay={0.08}>
              <h2
                className="mt-8 max-w-[520px] text-[34px] leading-[1.06] tracking-[-0.03em] md:text-[52px]"
                style={{ ...uiFont, fontWeight: 600, color: SITE_DARK }}
              >
                Administrar um estúdio nunca foi apenas fotografar.
              </h2>
            </Fade>

            <Fade delay={0.16}>
              <div className="mt-10 max-w-[460px] space-y-3">
                {GROUP_A.map((line) => (
                  <p
                    key={line}
                    className="text-[17px] leading-[1.8] md:text-[18px]"
                    style={{ ...uiFont, color: "rgba(11,11,11,0.62)" }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </Fade>

            <Fade delay={0.22}>
              <div className="mt-10 max-w-[460px] space-y-3">
                {GROUP_B.map((line) => (
                  <p
                    key={line}
                    className="text-[17px] leading-[1.8] md:text-[18px]"
                    style={{ ...uiFont, color: "rgba(11,11,11,0.62)" }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </Fade>
          </div>

          {/* Visual — 1º no desktop (esquerda), 2º no mobile */}
          <Fade delay={0.06} className="order-2 md:order-1">
            <div
              ref={ref}
              className="w-full overflow-hidden aspect-[16/9] md:aspect-[4/5]"
            >
              <motion.img
                src={rotinaImg}
                alt="Provas fotográficas, contrato e agenda organizados sobre uma mesa clara com luz natural"
                width={1920}
                height={1080}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
                style={reduce ? undefined : { y, scale: 1.08 }}
              />
            </div>
          </Fade>
        </div>
      </div>
    </section>
  );
}
