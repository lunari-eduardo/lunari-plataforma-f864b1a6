import { motion, useReducedMotion } from "framer-motion";
import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  EyebrowTag,
  PrimaryButton,
  GhostLink,
  EASE,
  displayFont,
  uiFont,
} from "./primitives";
import { HeroMockup } from "./mockups/HeroMockup";

export function LunariHero() {
  const nav = useNavigate();
  const reduce = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: reduce ? {} : { opacity: 0, y: 24 },
    animate: reduce ? {} : { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: EASE, delay },
  });

  return (
    <section className="relative min-h-[92vh] w-full overflow-hidden pt-32 pb-16 md:pt-40">
      {/* Ambient light */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201,123,58,0.18), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-6 md:px-8">
        <motion.div {...fadeUp(0)} className="flex justify-center">
          <EyebrowTag>Feito por fotógrafos, não por engenheiros de SaaS</EyebrowTag>
        </motion.div>

        <motion.h1
          {...fadeUp(0.1)}
          className="mx-auto mt-8 max-w-[900px] text-center text-[44px] leading-[1.02] tracking-[-0.025em] text-[#0B1B2B] md:text-[72px]"
          style={displayFont}
        >
          O primeiro sistema que{" "}
          <em className="font-normal italic text-[#C97B3A]">entende</em> o que é
          uma sessão.
        </motion.h1>

        <motion.p
          {...fadeUp(0.2)}
          className="mx-auto mt-7 max-w-[600px] text-center text-[17px] leading-[1.55] text-[#0B1B2B]/65 md:text-[18px]"
          style={uiFont}
        >
          CRM, agenda, contratos, financeiro, galeria e IA operando como um só
          cérebro. Enquanto os outros vendem 6 ferramentas, a Lunari entrega{" "}
          <span className="text-[#0B1B2B]">um estúdio inteiro</span>.
        </motion.p>

        <motion.div
          {...fadeUp(0.3)}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <PrimaryButton onClick={() => nav("/auth")}>
            Testar 30 dias grátis
          </PrimaryButton>
          <GhostLink onClick={() => {
            document.getElementById("produto")?.scrollIntoView({ behavior: "smooth" });
          }}>
            <Play className="h-3.5 w-3.5" strokeWidth={2.5} />
            Ver o sistema em ação
          </GhostLink>
        </motion.div>

        <motion.p
          {...fadeUp(0.4)}
          className="mt-4 text-center text-[13px] text-[#0B1B2B]/45"
          style={uiFont}
        >
          Sem cartão de crédito · Cancele a qualquer momento
        </motion.p>

        {/* Mockup */}
        <motion.div
          initial={reduce ? {} : { opacity: 0, y: 40, scale: 0.98 }}
          animate={reduce ? {} : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.5 }}
          className="relative mt-16 md:mt-20"
        >
          <HeroMockup />
        </motion.div>
      </div>
    </section>
  );
}
