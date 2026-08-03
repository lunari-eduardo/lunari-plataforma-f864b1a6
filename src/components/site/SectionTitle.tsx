/**
 * SectionTitle — título de seção institucional com contraste forte.
 *
 * Regra: h2 usa Geist 600 (peso real, não serifada fina). A palavra-âncora
 * `emphasis` fica em Instrument Serif italic + ouro champagne (`#C9A87C`).
 */
import { ReactNode } from "react";
import { TOKENS, displayFont, uiFont } from "@/components/landing/primitives";

type Tone = "light" | "dark";

export function SectionTitle({
  children,
  emphasis,
  tone = "light",
  size = "md",
  className = "",
  as = "h2",
}: {
  children: ReactNode;
  emphasis?: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const sizeCls =
    size === "lg"
      ? "text-[40px] leading-[1.03] md:text-[64px]"
      : size === "sm"
        ? "text-[26px] leading-[1.15] md:text-[34px]"
        : "text-[32px] leading-[1.05] md:text-[48px]";

  const color = tone === "dark" ? "#FAFAF7" : "#0A0A0A";
  const accent = TOKENS.gold;

  const Tag = as;
  return (
    <Tag
      className={`${sizeCls} tracking-[-0.03em] ${className}`}
      style={{
        ...uiFont,
        color,
        fontWeight: 600,
        letterSpacing: "-0.028em",
      }}
    >
      {children}
      {emphasis && (
        <>
          {" "}
          <span
            className="italic"
            style={{ ...displayFont, color: accent, fontWeight: 400 }}
          >
            {emphasis}
          </span>
        </>
      )}
    </Tag>
  );
}

/** Rótulo pequeno acima do título (subtítulo terroso). */
export function SectionKicker({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <p
      className="text-[13px] font-normal leading-[1.5] md:text-[14px]"
      style={{
        ...uiFont,
        color: tone === "dark" ? "rgba(255,255,255,0.65)" : "rgba(10,10,10,0.62)",
      }}
    >
      {children}
    </p>
  );
}
