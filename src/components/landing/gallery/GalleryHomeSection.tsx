import { motion, useReducedMotion } from "framer-motion";
import { EASE, monoFont } from "../primitives";
import {
  ProductBody,
  ProductCTA,
  ProductChips,
  ProductEyebrow,
  ProductHeadline,
  ProductSection,
  ProductTitle,
  SITE_GOLD,
  SoftReveal,
} from "../shared/ProductSection";

const CHIPS = [
  "Seleção Online",
  "Entrega Profissional",
  "Venda de Extras",
  "Temas Personalizados",
  "Download Organizado",
  "Histórico Integrado",
];

const TONES = [
  "#E8DFCF", "#D9C8B4", "#E5D6C4", "#CFC0A8",
  "#DECBB0", "#EFE7DA", "#C9B99A", "#E2D5C0",
  "#D4C2A6", "#EDE3D2", "#C4B096", "#E8DDC7",
];

const MARKED = [1, 6];

/**
 * Seção 05 — Lunari Gallery.
 * Composição: folha de contato em tons de papel, dois quadros marcados
 * por um traço dourado. Sugere seleção sem desenhar interface.
 */
export function GalleryHomeSection() {
  return (
    <ProductSection
      id="gallery"
      tone="light"
      visualSide="left"
      softTop="fromDark"
      text={
        <div className="text-left">
          <SoftReveal>
            <ProductEyebrow tone="light">Lunari Gallery</ProductEyebrow>
          </SoftReveal>
          <SoftReveal delay={0.05}>
            <ProductHeadline tone="light">
              Seu cliente espera uma experiência. Não apenas um link.
            </ProductHeadline>
          </SoftReveal>
          <SoftReveal delay={0.1}>
            <ProductTitle tone="light">
              Da seleção à entrega.
              <br />
              Tudo pensado para valorizar o seu trabalho.
            </ProductTitle>
          </SoftReveal>
          <SoftReveal delay={0.15}>
            <ProductBody
              tone="light"
              paragraphs={[
                "O cliente escolhe as fotos. Você acompanha tudo em tempo real.",
                "Venda fotos extras. Entregue galerias elegantes.",
                "Tudo conectado ao mesmo atendimento. Sem começar do zero a cada etapa.",
              ]}
            />
          </SoftReveal>
          <SoftReveal delay={0.2}>
            <ProductChips tone="light" items={CHIPS} />
          </SoftReveal>
          <SoftReveal delay={0.25}>
            <ProductCTA tone="light" to="/gallery">
              Conheça a Gallery
            </ProductCTA>
          </SoftReveal>
        </div>
      }
      visual={<ContactSheet />}
    />
  );
}

function ContactSheet() {
  const reduce = useReducedMotion();

  return (
    <div className="w-full md:pr-10">
      <div className="grid grid-cols-4 gap-2.5 md:gap-3">
        {TONES.map((tone, i) => {
          const marked = MARKED.includes(i);
          return (
            <motion.div
              key={i}
              initial={reduce ? undefined : { opacity: 0, y: 8 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.03 * i }}
              className="relative aspect-[4/5]"
              style={{ background: tone }}
            >
              {marked && (
                <>
                  <span
                    aria-hidden
                    className="absolute left-2 top-2 block h-4 w-px"
                    style={{ background: SITE_GOLD }}
                  />
                  <span
                    aria-hidden
                    className="absolute left-2 top-2 block h-px w-4"
                    style={{ background: SITE_GOLD }}
                  />
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      <div
        className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-[0.2em]"
        style={{ ...monoFont, color: "rgba(11,11,11,0.38)" }}
      >
        <span>Seleção do cliente</span>
        <span style={{ color: SITE_GOLD }}>2 marcadas</span>
      </div>
    </div>
  );
}
