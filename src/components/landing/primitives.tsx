import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Design tokens — Editorial Frio (Linear/Vercel/Arc-inspired)
 * - paper  #FAFAF7 (background neutro, quase branco)
 * - ink    #0A0A0A (preto verdadeiro)
 * - deep   #0F0F10 (fundo escuro para seções de quebra)
 * - ember  #b0632f (accent digital, uso ≤2× por dobra)
 * - hair   rgba(10,10,10,.06)
 *
 * Tipografia:
 * - display: Instrument Serif (só em 1–2 palavras-âncora por seção)
 * - ui:      Geist (300/400/500/600/700)
 * - mono:    Geist Mono
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

// Tokens exportados para uso inline
export const TOKENS = {
  paper: "#FAFAF7",
  ink: "#0A0A0A",
  deep: "#0F0F10",
  navy: "#061720",          // fundo escuro alternativo (assistente Lu, promoStrip)
  ember: "#b0632f",         // accent terra sobre paper
  emberOnDark: "#c47a3f",   // accent terra levemente mais quente sobre navy/deep
  hair: "rgba(10,10,10,0.08)",
  hairStrong: "rgba(10,10,10,0.14)",
  hairDark: "rgba(255,255,255,0.08)",
  hairDarkStrong: "rgba(255,255,255,0.14)",
};


export function SectionShell({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`relative w-full py-24 md:py-32 ${className}`}>
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">{children}</div>
    </section>
  );
}

export function EyebrowTag({
  children,
  tone = "light",
  index,
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  index?: string;
}) {
  const isDark = tone === "dark";
  return (
    <span
      className="inline-flex items-center gap-2.5 text-[10px] uppercase tracking-[0.22em] font-medium"
      style={{
        fontFamily: '"Geist Mono", "Geist Mono", "JetBrains Mono", monospace',
        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,10,10,0.55)",
      }}
    >
      {index && (
        <span
          className="tabular-nums"
          style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,10,10,0.35)" }}
        >
          {index}
        </span>
      )}
      <span
        className="inline-block h-[6px] w-[6px] rounded-full"
        style={{
          background: TOKENS.ember,
          boxShadow: `0 0 0 3px ${isDark ? "rgba(176,99,47,0.12)" : "rgba(176,99,47,0.08)"}`,
        }}
      />
      {children}
    </span>
  );
}

export function Reveal({
  children,
  delay = 0,
  y = 16,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  className = "",
  tone = "light",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  return (
    <button
      onClick={onClick}
      className={`group inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-5 text-[14px] font-medium transition-all duration-300 hover:-translate-y-[1px] active:translate-y-0 ${className}`}
      style={{
        fontFamily: '"Geist", "Geist", "Inter Tight", sans-serif',
        background: isDark ? TOKENS.paper : TOKENS.ink,
        color: isDark ? TOKENS.ink : TOKENS.paper,
        letterSpacing: "-0.005em",
        boxShadow: isDark
          ? "0 1px 0 rgba(255,255,255,0.08), 0 8px 20px -12px rgba(0,0,0,0.6)"
          : "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 20px -12px rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </button>
  );
}

export function GhostLink({
  children,
  onClick,
  className = "",
  tone = "light",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center gap-1.5 text-[14px] font-medium transition-colors ${className}`}
      style={{
        fontFamily: '"Geist", "Geist", "Inter Tight", sans-serif',
        color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,10,10,0.7)",
        letterSpacing: "-0.005em",
      }}
    >
      {children}
    </button>
  );
}

/** Grid de linhas hairline verticais — textura Linear/Rauno */
export function GridLines({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const color = tone === "dark" ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.04)";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px)`,
        backgroundSize: "96px 100%",
        maskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
      }}
    />
  );
}

/** Rótulo técnico (mono, uppercase, tracking wide) — dá densidade tech */
export function TechLabel({
  children,
  tone = "light",
  className = "",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.22em] tabular-nums ${className}`}
      style={{
        fontFamily: '"Geist Mono", "Geist Mono", "JetBrains Mono", monospace',
        color: tone === "dark" ? "rgba(255,255,255,0.45)" : "rgba(10,10,10,0.45)",
      }}
    >
      {children}
    </span>
  );
}

// Fontes inline (mantidas para retrocompat com componentes existentes)
export const displayFont = { fontFamily: '"Instrument Serif", "Instrument Serif", "Fraunces", Georgia, serif' };
export const uiFont = { fontFamily: '"Geist", "Geist", "Inter Tight", sans-serif', letterSpacing: "-0.005em" };
export const monoFont = { fontFamily: '"Geist Mono", "Geist Mono", "JetBrains Mono", monospace' };
