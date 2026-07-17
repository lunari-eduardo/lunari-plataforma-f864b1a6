import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Design tokens (locked):
 * - bone   #F5F1EA (background)
 * - noir   #0B1B2B (ink)
 * - amber  #C97B3A (accent, ≤3× per viewport)
 * - hair   rgba(11,27,43,.08)
 */

export const EASE = [0.22, 1, 0.36, 1] as const;

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
    <section
      id={id}
      className={`relative w-full py-24 md:py-32 ${className}`}
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">{children}</div>
    </section>
  );
}

export function EyebrowTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#0B1B2B]/15 bg-transparent px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#0B1B2B]/70 font-medium">
      <span className="h-1 w-1 rounded-full bg-[#C97B3A]" />
      {children}
    </span>
  );
}

export function Reveal({
  children,
  delay = 0,
  y = 20,
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
      viewport={{ once: true, amount: 0.3 }}
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
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group inline-flex h-11 items-center justify-center gap-2 rounded-[6px] bg-[#0B1B2B] px-6 text-[15px] font-semibold text-[#F5F1EA] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_12px_28px_-14px_rgba(11,27,43,0.55)] active:translate-y-0 ${className}`}
      style={{ fontFamily: '"Inter Tight", sans-serif' }}
    >
      {children}
    </button>
  );
}

export function GhostLink({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[15px] font-medium text-[#0B1B2B]/75 transition-colors hover:text-[#0B1B2B] ${className}`}
      style={{ fontFamily: '"Inter Tight", sans-serif' }}
    >
      {children}
    </button>
  );
}

export const displayFont = { fontFamily: '"Fraunces", Georgia, serif' };
export const uiFont = { fontFamily: '"Inter Tight", sans-serif' };
export const monoFont = { fontFamily: '"JetBrains Mono", monospace' };
