import { ReactNode } from "react";
import { SiteH2, SiteEyebrow } from "./typography";

type Tone = "light" | "dark";

export function SectionTitle({
  children,
  emphasis,
  tone = "light",
  className = "",
  // Mapeamos props legadas para não quebrar componentes existentes
  size,
  as,
}: {
  children: ReactNode;
  emphasis?: string;
  tone?: Tone;
  className?: string;
  size?: "sm" | "md" | "lg";
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <SiteH2 tone={tone} className={className}>
      {children}
      {emphasis && (
        <>
          {" "}
          <span className="text-site-gold italic font-normal" style={{ fontFamily: '"Instrument Serif", serif' }}>
            {emphasis}
          </span>
        </>
      )}
    </SiteH2>
  );
}

export function SectionKicker({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <SiteEyebrow className="mb-2">
      {children}
    </SiteEyebrow>
  );
}