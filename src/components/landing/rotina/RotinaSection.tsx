import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { EASE, TOKENS, monoFont, uiFont } from "../primitives";
import rotinaImg from "@/assets/home-rotina.jpg";

const PARAGRAPHS = [
  "Um estúdio cresce quando os clientes chegam.",
  "Mas a operação cresce junto.",
  "Foi entendendo essa realidade que o Lunari nasceu.",
  "Não para reinventar a forma de fotografar.",
  "Mas para organizar tudo o que acontece antes, durante e depois de cada ensaio.",
];

function Fade({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
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
      className="relative w-full py-32 md:py-44"
      style={{ background: TOKENS.paper, color: TOKENS.ink }}
    >
      <div className="mx-auto w-full max-w-[1120px] px-6 md:px-8">
        <Fade>
          <p
            className="text-center text-[11px] uppercase tracking-[0.24em] md:text-[12px]"
            style={{ ...monoFont, color: "rgba(10,10,10,0.45)" }}
          >
            01 <span style={{ color: TOKENS.ember }}>•</span> UMA ROTINA QUE CRESCE
          </p>
        </Fade>

        <Fade delay={0.08}>
          <h2
            className="mx-auto mt-10 max-w-[880px] text-center text-[38px] leading-[1.05] tracking-[-0.03em] md:text-[64px]"
            style={{ ...uiFont, fontWeight: 600 }}
          >
            Administrar um estúdio nunca foi apenas fotografar.
          </h2>
        </Fade>

        <div className="mx-auto mt-14 flex max-w-[640px] flex-col gap-7 md:mt-16 md:gap-8">
          {PARAGRAPHS.map((line, i) => (
            <Fade key={line} delay={0.14 + i * 0.06}>
              <p
                className="text-center text-[18px] leading-[1.85] md:text-[19px]"
                style={{ ...uiFont, color: "rgba(10,10,10,0.62)" }}
              >
                {line}
              </p>
            </Fade>
          ))}
        </div>

        <Fade delay={0.2}>
          <div
            ref={ref}
            className="mt-24 w-full overflow-hidden md:mt-32"
            style={{ aspectRatio: "16 / 9" }}
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
    </section>
  );
}
