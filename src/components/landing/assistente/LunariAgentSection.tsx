import { motion, useReducedMotion } from "framer-motion";
import { EASE, displayFont, monoFont, uiFont } from "../primitives";
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
  "Comandos por Voz",
  "Agente Inteligente",
  "Agenda",
  "Financeiro",
  "Clientes",
  "Tarefas",
];

const ACOES = [
  "agendamento criado",
  "pagamento registrado",
  "tarefa concluída",
];

/**
 * Seção 06 — Lunari (agente).
 * Composição: comando → ação. Sem balões, sem avatar, sem interface de chat.
 */
export function LunariAgentSection() {
  return (
    <ProductSection
      id="lunari"
      tone="dark"
      visualSide="right"
      softTop="fromLight"
      text={
        <div className="text-left">
          <SoftReveal>
            <ProductEyebrow tone="dark">Lunari</ProductEyebrow>
          </SoftReveal>
          <SoftReveal delay={0.1}>
            <ProductTitle tone="dark">
              Converse.
              <br />
              Peça.
              <br />A Lunari executa.
            </ProductTitle>
          </SoftReveal>
          <SoftReveal delay={0.15}>
            <ProductBody
              tone="dark"
              paragraphs={[
                "Agende ensaios. Registre pagamentos. Encontre clientes.",
                "Gerencie tarefas. Consulte informações.",
                "Tudo por conversa. Tudo dentro do contexto do seu estúdio.",
              ]}
            />
          </SoftReveal>
          <SoftReveal delay={0.2}>
            <ProductChips tone="dark" items={CHIPS} />
          </SoftReveal>
          <SoftReveal delay={0.25}>
            <ProductCTA tone="dark" to="/studio">
              Conheça a Lunari
            </ProductCTA>
          </SoftReveal>
        </div>
      }
      visual={<ComandoAcao />}
    />
  );
}

function ComandoAcao() {
  const reduce = useReducedMotion();

  return (
    <div className="w-full md:pl-10">
      <SoftReveal>
        <p
          className="text-[22px] leading-[1.3] md:text-[30px]"
          style={{ ...displayFont, color: "#F5F1EA" }}
        >
          “Remarque a Ana para quinta, registre a entrada de R$ 400 e me lembre
          de enviar a prévia.”
        </p>
      </SoftReveal>

      <div className="mt-12 space-y-6">
        {ACOES.map((a, i) => (
          <motion.div
            key={a}
            initial={reduce ? undefined : { opacity: 0, x: -8 }}
            whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.12 * i }}
            className="flex items-center gap-4"
          >
            <span
              aria-hidden
              className="block h-px"
              style={{ width: 56 + i * 22, background: SITE_GOLD, opacity: 0.7 }}
            />
            <span
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ ...monoFont, color: "rgba(245,241,234,0.62)" }}
            >
              {a}
            </span>
          </motion.div>
        ))}
      </div>

      <SoftReveal delay={0.4}>
        <p
          className="mt-12 text-[13px]"
          style={{ ...uiFont, color: "rgba(245,241,234,0.38)" }}
        >
          Nenhuma ação sensível acontece sem sua confirmação.
        </p>
      </SoftReveal>
    </div>
  );
}
