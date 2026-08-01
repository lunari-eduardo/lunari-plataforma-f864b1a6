import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Play, Sparkles } from "lucide-react";
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

  const fadeUp = (delay: number) => ({
    initial: reduce ? {} : { opacity: 0, y: 20 },
    animate: reduce ? {} : { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: EASE, delay },
  });

  return (
    <section
      className="relative flex w-full items-center overflow-hidden min-h-[85svh] pt-28 pb-20 md:min-h-[100svh] md:pt-32 md:pb-24"
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
              className="group inline-flex h-12 items-center gap-2 rounded-[10px] px-6 text-[14px] font-medium transition-all duration-300 hover:-translate-y-[1px]"
              style={{
                ...uiFont,
                background: TOKENS.gold,
                color: TOKENS.obsidian,
                boxShadow: "0 18px 40px -22px rgba(201,168,124,0.9)",
              }}
            >
              Conhecer a Lunari
              <ArrowUpRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.75}
              />
            </button>

            <button
              onClick={() =>
                document.getElementById("produto")?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex h-12 items-center gap-2.5 rounded-[10px] border px-6 text-[14px] font-medium transition-colors"
              style={{
                ...uiFont,
                borderColor: TOKENS.hairDarkStrong,
                color: TOKENS.onDark,
              }}
            >
              <Play className="h-4 w-4" strokeWidth={1.5} style={{ color: TOKENS.gold }} />
              Ver demonstração
            </button>
          </motion.div>

          {/* ---------- Garantias em cascata ---------- */}
          <ul
            className="mt-12 flex max-w-[560px] flex-col gap-3 border-t pt-8 md:flex-row md:flex-wrap md:gap-x-7 md:gap-y-3"
            style={{ borderColor: TOKENS.hairDark }}
          >
            {GUARANTEES.map((item, i) => (
              <motion.li
                key={item}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.45 + i * 0.09 }}
                className="flex items-center gap-2.5 text-[14px]"
                style={{ ...uiFont, color: TOKENS.onDarkMuted }}
              >
                <span
                  className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: "rgba(201,168,124,0.35)" }}
                >
                  <Check className="h-3 w-3" strokeWidth={1.75} style={{ color: TOKENS.gold }} />
                </span>
                {item}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

    </section>
  );
}
