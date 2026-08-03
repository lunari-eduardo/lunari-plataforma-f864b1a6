import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { EASE, monoFont, uiFont, displayFont } from "../primitives";

export const SITE_LIGHT = "#F7F5F2";
export const SITE_DARK = "#0B0B0B";
export const SITE_GOLD = "#C9A87C";

/** Fade + translate discreto, sem dependência de scroll além da entrada. */
export function SoftReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Casca das seções de produto da Home (Studio, Gallery, Lunari).
 * Grid 40/60 no desktop, empilhado (texto → visual) no mobile.
 */
export function ProductSection({
  id,
  tone,
  visualSide = "right",
  text,
  visual,
  softTop = false,
  ratio = "40/60",
}: {
  id?: string;
  tone: "dark" | "light";
  visualSide?: "left" | "right";
  text: ReactNode;
  visual: ReactNode;
  /** faixa de transição suave a partir do tom da seção anterior */
  softTop?: false | "fromLight" | "fromDark";
  /** proporção do grid no desktop */
  ratio?: "40/60" | "45/55" | "35/65";
}) {
  const isDark = tone === "dark";
  const bg = isDark ? SITE_DARK : SITE_LIGHT;
  const fg = isDark ? "#F5F1EA" : SITE_DARK;

  return (
    <section
      id={id}
      className="relative w-full overflow-hidden py-20 md:py-36"
      style={{ background: bg, color: fg }}
    >
      {softTop && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24"
          style={{
            background: `linear-gradient(to bottom, ${
              softTop === "fromLight" ? SITE_LIGHT : SITE_DARK
            }, ${bg})`,
          }}
        />
      )}

      <div className="relative mx-auto w-full max-w-[1200px] px-6 md:px-8">
        <div
          className={`grid grid-cols-1 items-center gap-14 md:gap-16 ${
            ratio === "45/55"
              ? "md:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]"
              : ratio === "35/65"
                ? "md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]"
                : "md:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]"
          }`}
        >
          <div className={visualSide === "left" ? "md:order-2" : ""}>{text}</div>
          <div className={visualSide === "left" ? "md:order-1" : ""}>{visual}</div>
        </div>
      </div>
    </section>
  );
}

export function ProductEyebrow({ tone, children }: { tone: "dark" | "light"; children: ReactNode }) {
  const isDark = tone === "dark";
  return (
    <span
      className="inline-flex items-center gap-2.5 text-[10px] uppercase tracking-[0.24em]"
      style={{
        ...monoFont,
        color: isDark ? "rgba(245,241,234,0.55)" : "rgba(11,11,11,0.5)",
      }}
    >
      <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: SITE_GOLD }} />
      {children}
    </span>
  );
}

export function ProductHeadline({ tone, children }: { tone: "dark" | "light"; children: ReactNode }) {
  return (
    <p
      className="mt-7 text-[20px] leading-[1.3] md:text-[24px]"
      style={{
        ...displayFont,
        fontStyle: "italic",
        color: SITE_GOLD,
      }}
    >
      {children}
    </p>
  );
}

export function ProductTitle({ tone, children }: { tone: "dark" | "light"; children: ReactNode }) {
  const isDark = tone === "dark";
  return (
    <h2
      className="mt-5 text-[30px] leading-[1.08] md:text-[44px]"
      style={{
        ...uiFont,
        fontWeight: 600,
        letterSpacing: "-0.03em",
        color: isDark ? "#F5F1EA" : SITE_DARK,
      }}
    >
      {children}
    </h2>
  );
}

export function ProductBody({
  tone,
  paragraphs,
}: {
  tone: "dark" | "light";
  paragraphs: string[];
}) {
  const isDark = tone === "dark";
  return (
    <div className="mt-7 space-y-3.5 md:max-w-[440px]">
      {paragraphs.map((p) => (
        <p
          key={p}
          className="text-[15px] leading-[1.62] md:text-[16px]"
          style={{
            ...uiFont,
            color: isDark ? "rgba(245,241,234,0.66)" : "rgba(11,11,11,0.66)",
          }}
        >
          {p}
        </p>
      ))}
    </div>
  );
}

/** Chips minimalistas: só tipografia, sem caixa, sem ícone. */
export function ProductChips({ tone, items }: { tone: "dark" | "light"; items: string[] }) {
  const isDark = tone === "dark";
  return (
    <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="text-[11px] uppercase tracking-[0.16em] transition-colors duration-200"
          style={{
            ...monoFont,
            color: isDark ? "rgba(245,241,234,0.48)" : "rgba(11,11,11,0.48)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = SITE_GOLD)}
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = isDark
              ? "rgba(245,241,234,0.48)"
              : "rgba(11,11,11,0.48)")
          }
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ProductCTA({
  tone,
  to,
  children,
}: {
  tone: "dark" | "light";
  to: string;
  children: ReactNode;
}) {
  const isDark = tone === "dark";
  return (
    <Link
      to={to}
      className="group mt-10 inline-flex items-center gap-2 pb-1 text-[14px] transition-colors duration-200"
      style={{
        ...uiFont,
        color: isDark ? "#F5F1EA" : SITE_DARK,
        borderBottom: `1px solid ${isDark ? "rgba(245,241,234,0.22)" : "rgba(11,11,11,0.18)"}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = SITE_GOLD;
        e.currentTarget.style.borderBottomColor = SITE_GOLD;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = isDark ? "#F5F1EA" : SITE_DARK;
        e.currentTarget.style.borderBottomColor = isDark
          ? "rgba(245,241,234,0.22)"
          : "rgba(11,11,11,0.18)";
      }}
    >
      {children}
      <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
    </Link>
  );
}
