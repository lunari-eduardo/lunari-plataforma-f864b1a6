import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, Check, Play, Sparkles, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EASE, TOKENS, displayFont, monoFont, uiFont } from "./primitives";
import { HeroBackgroundVideo } from "./HeroMedia";

const GUARANTEES = [
  "Contratos digitais",
  "Financeiro integrado",
  "Workflow inteligente",
  "Galerias profissionais",
  "Inteligência Artificial",
];

export function LunariHero() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  
  const contentOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const contentY = useTransform(scrollY, [0, 400], [0, -40]);
  const videoOpacity = useTransform(scrollY, [0, 600], [0.7, 0.4]);

  const fadeUp = (delay: number) => ({
    initial: reduce ? {} : { opacity: 0, y: 20 },
    animate: reduce ? {} : { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: EASE, delay },
  });

  return (
    <section
      className="relative flex w-full flex-col items-center justify-center overflow-hidden min-h-[100svh] pt-32 pb-24 md:pt-40"
      style={{ background: TOKENS.obsidian, color: TOKENS.onDark }}
    >
      <HeroBackgroundVideo />

      {/* linhas verticais sutis */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: "96px 100%",
          maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 md:px-8">
        <div className="max-w-[720px]">

          <motion.div {...fadeUp(0)}>
            <span
              className="inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.22em]"
              style={{
                ...monoFont,
                borderColor: TOKENS.hairDarkStrong,
                color: TOKENS.onDarkMuted,
              }}
            >
              <Sparkles className="h-3 w-3" strokeWidth={1.5} style={{ color: TOKENS.gold }} />
              O novo padrão para fotógrafos profissionais
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp(0.08)}
            className="mt-9 max-w-[620px] text-[42px] font-medium leading-[1.03] tracking-[-0.035em] md:text-[62px]"
            style={{ ...uiFont, color: TOKENS.onDark }}
          >
            O sistema que administra seu estúdio inteiro.{" "}
            <br />
            <span className="italic font-normal" style={{ ...displayFont, color: TOKENS.gold }}>
              Não apenas uma parte dele.
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.16)}
            className="mt-7 max-w-[540px] text-[16px] leading-[1.65] md:text-[18px]"
            style={{ ...uiFont, color: TOKENS.onDarkMuted }}
          >
            Construído por quem entende a rotina real de um estúdio profissional. 
            Uma plataforma unificada para elevar sua fotografia a um novo nível de eficiência.
          </motion.p>

          <motion.div {...fadeUp(0.24)} className="mt-9 flex flex-wrap items-center gap-3">
            <button
              onClick={() => nav("/auth")}
              className="group inline-flex h-12 items-center gap-2 rounded-[10px] px-8 text-[14px] font-medium transition-all duration-300 hover:brightness-110"
              style={{
                ...uiFont,
                background: TOKENS.obsidianSoft,
                border: `1px solid ${TOKENS.hairDarkStrong}`,
                color: TOKENS.onDark,
              }}
            >
              Começar agora
              <ArrowUpRight
                className="h-4 w-4 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                strokeWidth={1.75}
              />
            </button>

            <button
              onClick={() =>
                document.getElementById("produto")?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex h-12 items-center gap-2.5 rounded-[10px] px-6 text-[14px] font-medium transition-colors hover:text-white"
              style={{
                ...uiFont,
                color: TOKENS.onDarkMuted,
              }}
            >
              Ver o ecossistema
            </button>
          </motion.div>

          {/* ---------- Garantias em cascata ---------- */}
          <ul
            className="mt-14 flex max-w-[560px] flex-col gap-4 border-t pt-10 md:flex-row md:flex-wrap md:gap-x-9 md:gap-y-4"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            {GUARANTEES.map((item, i) => (
              <motion.li
                key={item}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.45 + i * 0.09 }}
                className="flex items-center gap-2.5 text-[13px] tracking-wide"
                style={{ ...monoFont, color: TOKENS.onDarkFaint }}
              >
                <div
                  className="h-1 w-1 rounded-full"
                  style={{ background: TOKENS.gold, opacity: 0.4 }}
                />
                {item}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

    </section>
  );
}
