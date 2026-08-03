import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "../primitives";
import studioHub from "@/assets/site/studio-hub.png.asset.json";
import {
  ProductBody,
  ProductCTA,
  ProductEyebrow,
  ProductHeadline,
  ProductSection,
  ProductTitle,
  SoftReveal,
} from "../shared/ProductSection";

/**
 * Seção 04 — Lunari Studio.
 * Texto à esquerda (45%), ilustração premium à direita (55%),
 * fundida ao fundo preto absoluto da seção.
 */
export function StudioSection() {
  return (
    <ProductSection
      id="studio"
      tone="dark"
      visualSide="right"
      softTop="fromLight"
      ratio="45/55"
      text={
        <div className="relative z-10 text-left">
          <SoftReveal>
            <ProductEyebrow tone="dark">Lunari Studio</ProductEyebrow>
          </SoftReveal>
          <SoftReveal delay={0.05}>
            <ProductHeadline tone="dark">
              Fotografar já dá trabalho suficiente.
            </ProductHeadline>
          </SoftReveal>
          <SoftReveal delay={0.1}>
            <ProductTitle tone="dark">
              Seu estúdio muda todos os dias.
              <br />O sistema precisa acompanhar.
            </ProductTitle>
          </SoftReveal>
          <SoftReveal delay={0.15}>
            <ProductBody
              tone="dark"
              paragraphs={[
                "Clientes chegam. Pagamentos são confirmados. Contratos são assinados. Fotos são selecionadas. Novos pedidos aparecem.",
                "Nada disso acontece separado.",
                "O Studio conecta agenda, clientes, contratos, financeiro e workflow para que cada atendimento continue completo do início ao fim.",
              ]}
            />
          </SoftReveal>
          <SoftReveal delay={0.25}>
            <ProductCTA tone="dark" to="/studio">
              Conheça o Studio
            </ProductCTA>
          </SoftReveal>
        </div>
      }
      visual={<StudioComposition />}
    />
  );
}

function StudioComposition() {
  const reduce = useReducedMotion();

  return (
    <div className="relative w-full md:-ml-[3.5rem] md:-mr-10 md:w-[calc(100%+3.5rem+2.5rem)]">
      {/* halo dourado extremamente discreto */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 55% at 55% 45%, rgba(201,168,124,0.13), rgba(201,168,124,0) 70%)",
          filter: "blur(28px)",
        }}
      />

      <motion.div
        initial={reduce ? undefined : { opacity: 0, x: 40 }}
        whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative"
        style={{
          // dissolve nas bordas para fundir com o #0B0B0B da seção
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, #000 16%, #000 100%), linear-gradient(to bottom, #000 82%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, #000 16%, #000 100%), linear-gradient(to bottom, #000 82%, transparent 100%)",
          WebkitMaskComposite: "source-in",
          maskComposite: "intersect",
        }}
      >
        <img
          src={studioHub.url}
          alt="Painel do Lunari Studio conectando agenda, sessão, cliente e financeiro em um único fluxo"
          loading="lazy"
          decoding="async"
          className="block w-full select-none rounded-[28px]"
          style={{ filter: "drop-shadow(0 30px 70px rgba(0,0,0,0.55))" }}
        />
      </motion.div>
    </div>
  );
}
