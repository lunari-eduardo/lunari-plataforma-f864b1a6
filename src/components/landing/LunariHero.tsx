import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EASE, TOKENS, monoFont, uiFont } from "./primitives";
import { HeroInterfaceVideo } from "./HeroMedia";

/**
 * LunariHero — Hero clara em duas colunas.
 * Esquerda: copy. Direita: composição visual da interface (vídeo ou loop vivo).
 * Sem animação de scroll — nada compete com a composição.
 */
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
      className="relative w-full overflow-hidden pt-28 pb-20 md:min-h-[88svh] md:pt-36 md:pb-32"
      style={{ background: TOKENS.paper, color: TOKENS.ink }}
    >
      <div className="relative mx-auto flex w-full max-w-[1200px] items-center px-6 md:px-8">
        <div className="grid w-full items-center gap-14 md:grid-cols-[44%_56%] md:gap-10">
          {/* ---------- Coluna esquerda: copy ---------- */}
          <div className="max-w-[520px]">
            <motion.div {...fadeUp(0)}>
              <span
                className="inline-flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.22em]"
                style={{ ...monoFont, color: "rgba(10,10,10,0.55)" }}
              >
                <span
                  className="inline-block h-[6px] w-[6px] rounded-full"
                  style={{
                    background: TOKENS.ember,
                    boxShadow: "0 0 0 3px rgba(176,99,47,0.08)",
                  }}
                />
                Para fotógrafos que vivem da fotografia
              </span>
            </motion.div>

            <motion.h1
              {...fadeUp(0.08)}
              className="mt-7 text-[36px] font-medium leading-[1.06] tracking-[-0.035em] md:text-[50px]"
              style={uiFont}
            >
              O sistema que administra seu estúdio inteiro.{" "}
              <span style={{ color: "rgba(10,10,10,0.45)" }}>Não apenas uma parte dele.</span>
            </motion.h1>

            <motion.p
              {...fadeUp(0.16)}
              className="mt-6 max-w-[460px] text-[15.5px] leading-[1.65] md:text-[16px]"
              style={{ ...uiFont, color: "rgba(10,10,10,0.66)" }}
            >
              Do primeiro contato à entrega das fotos, clientes, agenda, contratos, financeiro,
              galerias e inteligência artificial permanecem conectados em um único lugar.
            </motion.p>

            <motion.ul
              {...fadeUp(0.22)}
              className="mt-5 space-y-1 text-[14px] leading-[1.6]"
              style={{ ...uiFont, color: "rgba(10,10,10,0.45)" }}
            >
              <li>Sem retrabalho.</li>
              <li>Sem informações espalhadas.</li>
              <li>Sem perder tempo procurando o que já deveria estar organizado.</li>
            </motion.ul>

            <motion.div {...fadeUp(0.3)} className="mt-9 flex flex-wrap items-center gap-3">
              <button
                onClick={() => nav("/auth")}
                className="group inline-flex h-11 items-center gap-2 rounded-[9px] px-6 text-[14px] font-medium transition-all duration-300 hover:-translate-y-[1px]"
                style={{
                  ...uiFont,
                  background: TOKENS.ink,
                  color: TOKENS.paper,
                  boxShadow: "0 14px 30px -18px rgba(10,10,10,0.6)",
                }}
              >
                Começar teste gratuito
                <ArrowUpRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  strokeWidth={1.75}
                />
              </button>

              <button
                onClick={() => nav("/studio")}
                className="inline-flex h-11 items-center rounded-[9px] border px-6 text-[14px] font-medium transition-colors"
                style={{
                  ...uiFont,
                  borderColor: TOKENS.hairStrong,
                  color: "rgba(10,10,10,0.78)",
                }}
              >
                Conhecer o Studio
              </button>
            </motion.div>

            <motion.p
              {...fadeUp(0.38)}
              className="mt-5 text-[11px] uppercase tracking-[0.16em]"
              style={{ ...monoFont, color: "rgba(10,10,10,0.4)" }}
            >
              30 dias gratuitos · sem cartão de crédito
            </motion.p>
          </div>

          {/* ---------- Coluna direita: composição visual ---------- */}
          <motion.div
            initial={reduce ? {} : { opacity: 0, scale: 0.985 }}
            animate={reduce ? {} : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.18 }}
            className="relative"
          >
            <HeroInterfaceVideo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
