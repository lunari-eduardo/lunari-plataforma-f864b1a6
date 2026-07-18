import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  PrimaryButton,
  GhostLink,
  GridLines,
  TechLabel,
  EASE,
} from "./primitives";
import { HeroMockup } from "./mockups/HeroMockup";

export function LunariHero() {
  const nav = useNavigate();
  const reduce = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: reduce ? {} : { opacity: 0, y: 20 },
    animate: reduce ? {} : { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: EASE, delay },
  });

  return (
    <section className="relative w-full overflow-hidden pt-32 pb-16 md:pt-36">
      <GridLines />

      {/* halo ember bem sutil no canto */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[10%] h-[400px] w-[600px] opacity-[0.18] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(176,99,47,0.6), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-6 md:px-8">
        {/* Eyebrow + section index */}
        <motion.div {...fadeUp(0)} className="flex items-center gap-4">
          <TechLabel>01 / 08 · Overview</TechLabel>
          <span className="h-px w-12 bg-[rgba(10,10,10,0.14)]" />
          <span
            className="inline-flex items-center gap-2 text-[11px] font-medium text-[rgba(10,10,10,0.55)]"
            style={{ fontFamily: '"Geist", sans-serif' }}
          >
            <span
              className="inline-block h-[6px] w-[6px] animate-pulse rounded-full"
              style={{ background: "#b0632f" }}
            />
            Feito por fotógrafos, não por engenheiros de SaaS
          </span>
        </motion.div>

        {/* Headline — alinhada à esquerda, tamanho medido */}
        <motion.h1
          {...fadeUp(0.08)}
          className="mt-10 max-w-[900px] text-[44px] font-medium leading-[1.02] tracking-[-0.035em] text-[#0A0A0A] md:text-[68px]"
          style={{ fontFamily: '"Geist", sans-serif' }}
        >
          O primeiro sistema
          <br />
          que{" "}
          <span
            className="italic font-normal"
            style={{ fontFamily: '"Instrument Serif", serif', color: "#0A0A0A" }}
          >
            entende
          </span>{" "}
          o que é uma sessão.
        </motion.h1>

        <motion.p
          {...fadeUp(0.16)}
          className="mt-7 max-w-[560px] text-[16px] leading-[1.6] text-[rgba(10,10,10,0.6)] md:text-[17px]"
        >
          CRM, agenda, contratos, financeiro, galeria e IA operando como um só
          cérebro. Enquanto os outros vendem seis ferramentas, a Lunari entrega{" "}
          <span className="text-[#0A0A0A]">um estúdio inteiro</span>.
        </motion.p>

        <motion.div
          {...fadeUp(0.24)}
          className="mt-9 flex flex-wrap items-center gap-4"
        >
          <PrimaryButton onClick={() => nav("/auth")}>
            Testar 30 dias grátis
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
          </PrimaryButton>
          <GhostLink
            onClick={() =>
              document.getElementById("produto")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Ver o sistema em ação →
          </GhostLink>
          <span className="ml-2 text-[12px] text-[rgba(10,10,10,0.4)]" style={{ fontFamily: '"Geist Mono", monospace' }}>
            sem cartão · cancele quando quiser
          </span>
        </motion.div>

        {/* KPIs técnicos abaixo do CTA — dá densidade */}
        <motion.div
          {...fadeUp(0.32)}
          className="mt-14 grid max-w-[720px] grid-cols-3 gap-8 border-t border-[rgba(10,10,10,0.08)] pt-8"
        >
          {[
            ["3.2s", "p95 dashboard"],
            ["6→1", "ferramentas → um cérebro"],
            ["24/7", "assistente Lu ao vivo"],
          ].map(([v, l]) => (
            <div key={l}>
              <div
                className="text-[26px] font-medium tabular-nums text-[#0A0A0A]"
                style={{ fontFamily: '"Geist", sans-serif', letterSpacing: "-0.02em" }}
              >
                {v}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[rgba(10,10,10,0.45)]" style={{ fontFamily: '"Geist Mono", monospace' }}>
                {l}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Mockup */}
        <motion.div
          initial={reduce ? {} : { opacity: 0, y: 40 }}
          animate={reduce ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.4 }}
          className="relative mt-16 md:mt-20"
        >
          <HeroMockup />
        </motion.div>
      </div>
    </section>
  );
}
