import { motion, useReducedMotion } from "framer-motion";
import { EASE, monoFont, uiFont } from "../primitives";
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
  "CRM",
  "Agenda",
  "Contratos Digitais",
  "Financeiro",
  "Workflow",
  "Análise de Vendas",
];

const MARCOS = [
  { label: "Cliente", detail: "Ana Ribeiro", w: 0.52 },
  { label: "Agenda", detail: "Ensaio confirmado", w: 0.78 },
  { label: "Contrato", detail: "Assinado", w: 0.64 },
  { label: "Financeiro", detail: "Entrada recebida", w: 0.9 },
  { label: "Seleção", detail: "Em andamento", w: 0.7, active: true },
  { label: "Extras", detail: "6 fotos", w: 0.46 },
  { label: "Entrega", detail: "—", w: 0.34 },
];

/**
 * Seção 04 — Lunari Studio.
 * Composição visual: "a linha do atendimento" — marcos de um mesmo
 * atendimento empilhados, sem moldura, integrados ao fundo.
 */
export function StudioSection() {
  return (
    <ProductSection
      id="studio"
      tone="dark"
      visualSide="right"
      softTop="fromLight"
      text={
        <div className="text-left">
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
          <SoftReveal delay={0.2}>
            <ProductChips tone="dark" items={CHIPS} />
          </SoftReveal>
          <SoftReveal delay={0.25}>
            <ProductCTA tone="dark" to="/studio">
              Conheça o Studio
            </ProductCTA>
          </SoftReveal>
        </div>
      }
      visual={<AtendimentoLine />}
    />
  );
}

function AtendimentoLine() {
  const reduce = useReducedMotion();

  return (
    <div className="relative w-full md:pl-10">
      {/* eixo vertical */}
      <div
        aria-hidden
        className="absolute left-0 top-0 h-full w-px md:left-10"
        style={{ background: "rgba(245,241,234,0.10)" }}
      />

      <div className="space-y-9 pl-6 md:space-y-11 md:pl-8">
        {MARCOS.map((m, i) => (
          <motion.div
            key={m.label}
            initial={reduce ? undefined : { opacity: 0, y: 10 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.06 * i }}
            className="relative"
          >
            {/* marcador */}
            <span
              aria-hidden
              className="absolute -left-6 top-[7px] block h-[5px] w-[5px] rounded-full md:-left-8"
              style={{
                background: m.active ? SITE_GOLD : "rgba(245,241,234,0.22)",
                boxShadow: m.active ? `0 0 0 4px rgba(201,168,124,0.14)` : undefined,
              }}
            />

            <div className="flex items-baseline justify-between gap-6">
              <span
                className="text-[13px] md:text-[15px]"
                style={{
                  ...uiFont,
                  color: m.active ? SITE_GOLD : "rgba(245,241,234,0.88)",
                  fontWeight: 500,
                }}
              >
                {m.label}
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.16em]"
                style={{ ...monoFont, color: "rgba(245,241,234,0.38)" }}
              >
                {m.detail}
              </span>
            </div>

            {/* traço proporcional — peso do marco no atendimento */}
            <div className="mt-3 h-px w-full" style={{ background: "rgba(245,241,234,0.06)" }}>
              <motion.div
                className="h-px origin-left"
                style={{
                  width: `${m.w * 100}%`,
                  background: m.active ? SITE_GOLD : "rgba(245,241,234,0.20)",
                }}
                initial={reduce ? undefined : { scaleX: 0 }}
                whileInView={reduce ? undefined : { scaleX: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.08 * i }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
