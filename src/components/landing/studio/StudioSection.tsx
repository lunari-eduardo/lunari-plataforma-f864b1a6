import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { EASE, uiFont } from "../primitives";
import studioHub from "@/assets/site/studio-hub.png.asset.json";
import {
  ProductEyebrow,
  ProductHeadline,
  ProductSection,
  ProductTitle,
  SoftReveal,
  SITE_GOLD,
} from "../shared/ProductSection";

const TOOLS = ["CRM", "Agenda", "Orçamentos AI", "Contratos", "Financeiro", "Workflow"];

/**
 * Seção — Lunari Studio.
 * Texto mínimo à esquerda (35%), ilustração protagonista à direita (65%).
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
              Fotografar já dá
              <br />
              trabalho suficiente.
            </ProductHeadline>
          </SoftReveal>
          <SoftReveal delay={0.1}>
            <ProductTitle tone="dark">
              Seu sistema
              <br />
              precisa te ajudar.
            </ProductTitle>
          </SoftReveal>

          <ul className="mt-10 flex flex-col gap-[14px]">
            {TOOLS.map((tool, i) => (
              <SoftReveal key={tool} delay={0.16 + i * 0.04}>
                <ToolItem label={tool} />
              </SoftReveal>
            ))}
          </ul>

          <SoftReveal delay={0.45}>
            <StudioCTA />
          </SoftReveal>
        </div>
      }
      visual={<StudioComposition />}
    />
  );
}

function ToolItem({ label }: { label: string }) {
  return (
    <li
      className="group inline-flex cursor-default items-center gap-3 text-[18px] leading-none transition-colors duration-200 md:text-[20px]"
      style={{ ...uiFont, fontWeight: 500, color: "rgba(245,241,234,0.86)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = SITE_GOLD)}
      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,241,234,0.86)")}
    >
      <span
        aria-hidden
        className="inline-block text-[14px] transition-transform duration-200 group-hover:translate-x-[2px]"
        style={{ color: SITE_GOLD, opacity: 0.7 }}
      >
        →
      </span>
      {label}
    </li>
  );
}

function StudioCTA() {
  return (
    <Link
      to="/studio"
      className="group mt-11 inline-flex items-center gap-2 text-[15px] no-underline transition-colors duration-200 hover:underline"
      style={{ ...uiFont, color: "#F5F1EA", textUnderlineOffset: "6px" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = SITE_GOLD)}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#F5F1EA")}
    >
      Conheça o Studio
      <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
    </Link>
  );
}

function StudioComposition() {
  const reduce = useReducedMotion();

  return (
    <div className="relative w-full md:w-[calc(100%+4rem)]">
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
        className="relative mx-auto max-w-[480px] md:ml-auto md:mr-0 md:max-w-none"
        style={{
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
          className="block h-auto w-full select-none rounded-[20px] md:max-h-[560px] md:object-contain md:object-right"
          style={{ filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.45))" }}
        />
      </motion.div>
    </div>
  );
}
